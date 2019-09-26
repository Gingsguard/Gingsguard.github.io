---
title: IPS Community Suite PHP远程代码执行漏洞分析
date: 2017-11-2 14:35:31
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite-PHP远程代码执行漏洞分析.jpg)

"IPS Community Suite "是一款在国外广泛使用的建站系统。近期被曝出在4.1.12.3版本及以下版本存在代码注入漏洞。这个漏洞通过控制content_class参数提交的请求来注入代码，以至于可以远程执行PHP代码。

<!--more-->

### 影响版本

IPS版本：&lt;=4.1.12.3

### 漏洞分析

根据纰漏的漏洞细节，可以分析出这次漏洞的问题在于content_class这个参数。经过在源文件中搜索，发现这个参数在/applications/core/modules/front/system/content.php文件中被使用。、

[![ips-community-suite1](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite1-300x90.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite1.jpg)

在content.php文件中的find()函数里，IPSRequest::i()-&gt;content_class方法获取了GET提交的content_class参数，然后通过explode函数与implode函数进行字符串分割与拼接的处理，最后组合’IPS&#92;’字段赋值给$class。

我们接着看下一行的if语句：$class的值将传递到class_exists()函数中去，我们在这里简单的的介绍下class_exists()函数：

<pre class="lang:default decode:true ">bool class_exists ( string $class_name [, bool $autoload = true ] );</pre>

class_exists()函数是用来检查类是否已定义。它有两个参数，我们平时用这个方法的时候大都只给了第一个参数，第二个参数的默认值是默认为true，当不去设置第二个参数时，会去默认调用__autoload方法去加载类。

既然调用了__autoload方法，那不得不提到spl_autoload_register函数，这个方法会注册给定的函数作为 __autoload 的实现。 它实际上创建了 autoload 函数的队列，按定义时的顺序逐个执行。相比之下， [__autoload()](http://php.net/manual/zh/function.autoload.php) 只可以定义一次。

接下来我们查看/applications/cms/Application.php 文件中的  spl_autoload_register() 函数，这个函数会被class_exists ()函数默认调用。

[![ips-community-suite2](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite2-300x147.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite2.jpg)

在spl_autoload_register() 函数中，我们发现有如下几行代码：

[![ips-community-suite3](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite3-300x97.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite3.jpg)

前文content.php文件中的$class变量将通过如下两个if判断，我们接下来看看if里的内容，发现了$class变量的值经过处理后在eval()函数中可以被执行，初步判定代码执行漏洞在这里被触发。

因为两处触发点原理相同，我们就以第一处详细讲解：

[![ips-community-suite4](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite4-300x60.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite4.jpg)

如图所示，如果想顺利的进入if语句中，我们需要使$class变量前十四个字符串内容为’IPS\cms\Fields’;并且使第十五处字符为数字类型。

绕过判定后，$class变量中第十四个字符以后所有的字符将赋值给$databaseId变量，而$databaseId变量中的PHP函数将会被eval执行，这样远程代码执行漏洞就会被触发。

### <span style="font-size: large;"><span style="color: #000000;"><span style="font-family: 宋体;">漏洞利用</span></span></span>

我们分析下这个漏洞如何来利用，已知$class变量的值是通过content.php文件中的如下语句传递的：

[![ips-community-suite5](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite5-300x16.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite5.jpg)

在这里content_class值是可以通过GET提交控制的，所以我们提交如下content_class参数content_class=cms\Fields1{}phpinfo();/*

经过处理后的$class值如下：

&nbsp;

[![ips-community-suite6](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite6-300x9.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite6.jpg)

在/applications/cms/Application.php 文件中，$class的值顺利的绕过判定，进入if语句中去，此时的$databaseId变量值为

[![ips-community-suite7](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite7-300x12.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite7.jpg)

传入eval()中被执行。

Poc：

http://[host]/[ips]/index.php?app=core&amp;module=system&amp;controller=content&amp;do=find&amp;content_class=cms\Fields1{}phpinfo();/*

http://[host]/[ips]/index.php?app=core&amp;module=system&amp;controller=content&amp;do=find&amp;content_class= cms\extensions\core\EditorLocations\Records1{}phpinfo();/*

执行结果：

Poc执行后页面显示如下结果，和预期结果并不相同，

[caption id="attachment_5641" align="aligncenter" width="300"][![IPS Community Suite8](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite8-300x137.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite8.jpg) IPS Community Suite8[/caption]

我们接下来看一下抓包，发现返回的响应包中有三部分内容，第一部分为PHP报错信息，第二部分为phpinfo，而第三部分为原来/applications/core/modules/front/system/content.php中红框里代码执行后的结果：

[![ips-community-suite9](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite9-300x27.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite9.jpg)

上图红框里代码的作用是返回一个404页面，它正常执行后返回页面应如下图所示：

[![ips-community-suite10](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite10-300x130.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite10.jpg)

这三部分数据如下图所示：

[![ips-community-suite11](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite11-279x300.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite11.jpg)

由于这三个部分同时被服务器返回，前两部分为明文，而第三部分采用gzip压缩，导致浏览器显示内容编码错误，无法显示，但phpinfo()函数实际上被执行。

为了使验证结果更明显，我们将/applications/core/modules/front/system/content.php中的404返回信息注释掉，如下图所示。

[![ips-community-suite12](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite12-300x34.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite12.jpg)

让第三部分404页面信息不返回，再次发送poc请求，结果如下图所示：

[![ips-community-suite13](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite13-300x225.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite13.jpg)

### 官方修复分析

经过对比分析：

发现Application.php这个文件中原来的 spl_autoload_register() 和更新后

[![ips-community-suite14](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite14-300x225.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/IPS-Community-Suite14.jpg)

通过对比可以看出，这次漏洞修复是使用 intval() 函数进一步对mb_substr()函数的返回值进行来整数验证。使得$databaseId的值必须为一个整数，这样防止了eval()执行传入的PHP代码。

### 漏洞修复

1.  PHP  5.4.x  升级至 5.4.25 以上， 5.5.x 升级至 5.5.9 以上
2.  IPS 升级至`4.12.3.1 以上

如果您需要了解更多内容，可以
加入QQ群：570982169、486207500
直接询问：010-68438880-8669