---
title: Monstra CMS RCE漏洞分析（CVE-2020-13384）
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2016-NSFOCUS-Security-Report-Regarding-Network-Video-Surveillance-Systems.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
date: 2020-06-08 17:25:21
---

前言
----

MonstraCMS是一套基于PHP与XML的现代化的轻量级内容管理系统，整套系统无需使用数据库，据说是一家乌克兰的公司开发的。

![3f350f22ae8e79de93d135f70c943233.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528162937-5e159052-a0bd-1.png)

Monstra CMS 3.0.4版本中存在着一处安全漏洞，该漏洞源于程序没有正确验证文件扩展名。攻击者可以上传特殊后缀的文件执行任意PHP代码。但是通过分析后发现，这个漏洞的触发是依靠具体环境而来的，下文会详细介绍。

漏洞分析
--------

首先看一下Monstra CMS的功能页面

![c6750d01e77be3bcee89221884863cb6.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528162956-6970005e-a0bd-1.png)

可以发现有一个文件上传功能。通过阅读后台代码可知，程序是通过黑名单机制限制文件上传的类型：

![e5b8c37dbc5811e6c1eec837d184a4c7.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163011-72336f82-a0bd-1.png)

上图即是程序中用来限制上传的黑名单。程序不允许'html', 'htm', 'js', 'jsb', 'mhtml', 'mht', 'php', 'phtml', 'php3', 'php4', 'php5', 'phps','shtml', 'jhtml', 'pl', 'py', 'cgi', 'sh', 'ksh', 'bsh', 'c', 'htaccess', 'htpasswd','exe', 'scr', 'dll', 'msi', 'vbs', 'bat', 'com', 'pif', 'cmd', 'vxd', 'cpl','empty'后缀的文件上传

这个黑名单看起来还是很完善的，几乎防范了所有的类型

但是结合poc来看

https://www.exploit-db.com/exploits/48479

![a6b119cc4d4aa35e27b83fefd93fd78d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163025-7a69ee56-a0bd-1.png)

poc中上传了一个名为shell.php7的后门文件

后缀为php7的文件显然是可以绕过黑名单上传成功的，因为黑名单中只过滤了'php',
'phtml', 'php3', 'php4', 'php5', 'phps'，并未过滤php7后缀的文件上传。

在黑名单里，除了php后缀的文件比较常见，'phtml', 'php3', 'php4', 'php5',
'phps'这些是什么？为什么要写入上传黑名单里，这些后缀的文件可以被执行吗？

我们测试一下：

在windows下的wamp环境（apache2.4.37）：

php3后缀：

![782b032b499ed0bf817d5f63d12f6e89.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163041-83ea5da8-a0bd-1.png)

可以被解析

php5后缀：

![9ed1072ced8aee311a68426fac4c2587.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163055-8c6fec72-a0bd-1.png)

不可以被解析

php7后缀：

![705954217eaf37eb16955e4a11e7f213.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163111-96043a7c-a0bd-1.png)

不可以被解析

phtml后缀：

![5a15738d7852f72a00a8feaf1bda9564.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163124-9d8878b2-a0bd-1.png)

不可以被解析

再来看下Ubuntu下通过apt安装的环境（apache2.4.18）

php3后缀：

![cf301b9807e7370f2c87044393635f86.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163135-a4788266-a0bd-1.png)

可以被解析

php5后缀：

![e8b7fa17820bd058e0ac1b172b11e5d5.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163147-aba75396-a0bd-1.png)

可以被解析

php7后缀：

![1a888a5437d121a79c10c09cff05c8ab.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163158-b25380a2-a0bd-1.png)

可以被解析

phtml后缀：

![ee84ec983118f4e8a67a1eac5d69e80d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163210-b96931de-a0bd-1.png)

可以被解析

在处理php5、php7以及phtml后缀时，两个不同系统下不同版本的apache有着不同的处理方式。首先来说说这些不同的后缀到底是什么，再从原理上来看看为什么会导致解析结果的不同

据笔者猜测，不同的php后缀形式是用来标识此php文件的版本或者类型的

例如后缀为phtml的文件：

PHTML，正如其命名方式：是一种PHP脚本嵌在网页的HTML代码之中的文件。在页面被发送给请求的用户之前，后台服务器调用PHP来解释和执行PHP脚本。用后缀为phtml来标识这类php文件中嵌套着HTML代码

例如后缀为php+数字的文件：

用来标识当前php文件所采用的php开发版本，例如'php3', 'php4', 'php5',
'php7'对应了php的3、4、5、7版本号

至于为什么没有php2呢？我查了一下php的历史版本

![02312b54166d08e23d37e2a149e04990.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163228-c3e53e32-a0bd-1.png)

从历史记录来看，php3才是现在使用的php的第一个版本，因此从php3开始标记

所以'phtml', 'php3', 'php4', 'php5'，只是用来标识这个php文件的特点，但是后台仍然要把这个当作php文件解析

至于黑名单中并未过滤php7后缀的文件上传，可能是这套系统在开发时，php7还没有正式发行，开发者也就没有写入其中

但是为什么后台可以把这些后缀的文件当成php文件来解析呢？上文对于php5以及php7、phtml的解析结果为什么不同呢？

首先来看下windows下的apache关于后缀解析的配置，位于apache2.4.37/conf/mime.types

![c60b097e2358297d14fd511aa4ab6dfc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163241-cbb52906-a0bd-1.png)

此文件设置从文件扩展名到内容类型的默认映射列表。于此同时，httpd.conf通过提供大多数媒体类型定义以此简化mime.types文件，可以在httpd.conf中使用AddType指令根据需要进行指令覆盖。

通过查看可以发现，mime.types这里并没有定义php相关的后缀应该如何解析，接着我们看下httpd.conf，位于：apache2.4.37/conf/httpd.conf

![b87fa57b3829db6185f30f0fda32a78f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163258-d59c398c-a0bd-1.png)

可以看到存在

AddType application/x-httpd-php .php

AddType application/x-httpd-php .php3

这样的代码

官网中关于AddType 的解释如下：

![ab8271a46676e5f496a475798e1a5a7a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163311-ddc112a4-a0bd-1.png)

AddType *media-type* *extension* [*extension*] ...

该指令将给定的文件扩展名映射到指定的内容类型，media-type是用于包含extension的文件名的媒体类型。

这里的配置将会在处理php和php3扩展名的文件将会被标记上applciation/x-httpd-php，将二者标识为可以执行php的文件类型。

![137c440cf13bdcf7946a5619f21afdcd.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163326-e64814ae-a0bd-1.png)

从这里可以发现，系统可以把php以及php3的后缀当成php进行解析，而php5、php7、phtml后缀由于没有配置，不可以被解析。

接下来看一下Ubuntu下apache关于后缀解析的配置，位于/etc/mime.types

![152a4c2ac540ca6347f593654f0f2e54.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163340-eeb8acfc-a0bd-1.png)

可以看到，里面定义了phtml、php3、php5扩展名到内容类型的映射列表，但是并没有php7。接下来看下/etc/apache2/mods-enabled/php7.0.conf

![ea8225ca1e6d43a5496d9a41348cd3d9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163352-f5dc0b82-a0bd-1.png)

注意看第一个FilesMatch

![9026b4ce9a18c8e60d6a4aeb853a1fbc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163405-fdd299c8-a0bd-1.png)

正则表达式.+\\.ph(p[3457]?\|t\|tml)\$ 匹配到的扩展名，都将被标记上applciation/x-httpd-php，当成php文件解析。因此这里可以解析php7以及phtml后缀

如果想要让windows环境下的apache解析php5以及php7扩展名，在apache2.4.37/conf/httpd.conf文件中添加如下两行即可

![bb69baaf6abe2c091ce305d71dd5e848.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163418-058c06fe-a0be-1.png)

但是默认情况下，笔者的windows环境下的apache是无法解析php7扩展名的文件，因此这个漏洞对笔者的这个环境无效。

那在笔者Ubuntu apache环境下，可以上传的poc除了可以以php7为后缀，还可以是什么形式呢？

经过实验发现，Pht后缀也是可以的

![3216eb122ea45fe1e2ef17d0a9b9d6cc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163431-0d89f2da-a0be-1.png)

黑名单里根本没有pht后缀限制，正则表达式正则表达式.+\\.ph(p[3457]?\|t\|tml)\$也可以匹配到pht，因此pht后缀在笔者的环境中也可以被执行

![6107078502027f19a212e57390fa1c93.png](https://xzfile.aliyuncs.com/media/upload/picture/20200528163447-16ee790e-a0be-1.png)