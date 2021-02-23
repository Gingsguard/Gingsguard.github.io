---
title: 骑士cms从任意文件包含到远程代码执行漏洞分析
tags: web漏洞分析
categories: 技术
top_img: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg'
cover: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1190979594b32da626b7578f5d3de6c.jpg'
date: 2020-12-03 14:12:17
---

前言
----

前些日子，骑士cms 官方公布了一个系统紧急风险漏洞升级通知：骑士cms 6.0.48存在一处任意文件包含漏洞，利用该漏洞对payload文件进行包含，即可造成远程代码执行漏洞。这篇文章将从漏洞公告分析开始，叙述一下笔者分析漏洞与构造payload时遇到的有趣的事情。

漏洞情报
--------

官方发布的系统紧急风险漏洞升级通知如下：

http://www.74cms.com/news/show-2497.html

从官方公布的信息来看，官方修复了两个地方：

1、/Application/Common/Controller/BaseController.class.php

![5aa627c04fe6466d54325608c465affe.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110015-ab36dfcc-3513-1.png)

2、/ThinkPHP/Library/Think/View.class.php

![b1d2dab890cca24c649a871e938606bb.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110029-b3915648-3513-1.png)

从BaseController.class.php这处补丁来看：

笔者猜测漏洞多半出在了渲染简历模板的assign_resume_tpl方法中。从补丁修复上来看，增添了如下代码

```php
$tpl_file = $view->parseTemplate($tpl);

if(!is_file($tpl_file)){

return false;

}
```

可以发现程序通过$view->parseTemplate对$tpl参数进行处理，并对处理结果$tpl_file进行is_file判断

我们先跟入$view->parseTemplate看看

![5064cfae5a0467d8dac5852f77bdad0e.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110042-bb249816-3513-1.png)

从上图143行的结果来看，parseTemplate中也是先通过is_file判断，然后将符合的结果返回。

如果此处传入的$tpl变量是文件，那么这个文件可以顺利的通过parseTemplate与assign_resume_tpl方法中的is_file判断。回想一下，这是一个文件包含漏洞，成功利用的先前条件是恶意的文件得存在，然后被包含。这个漏洞多半是通过assign_resume_tpl方法的$tpl参数传入一个真实存在的待包含的恶意文件，而补丁先通过parseTemplate方法内的is_file判断了一次这个恶意文件是否存在，接着又在assign_resume_tpl方法通过is_file方法判断一次，成功的利用一定会使is_file为true。那assign_resume_tpl方法中增加的代码是否有作用？又有着什么作用？

这个问题笔者将在文章最后介绍。

接下来从第二处View.class.php这处补丁来看：

补丁将fetch 方法中

```php
if(!is_file($templateFile)) E(L('_TEMPLATE_NOT_EXIST_').':'.$templateFile);
```

代码注释替换为

```php
if(!is_file($templateFile)) E(L('_TEMPLATE_NOT_EXIST_'));
```

在thinkphp中，E()函数是用来抛出异常处理的。可见这处的修改应该是不想让$templateFile变量值写到日志log文件中。

单从这点来看，命令执行所需的payload百分百是可以通过$templateFile变量写到log文件里的,然后配合任意文件包含漏洞将这个log文件包含并执行。

漏洞分析
--------

通过对漏洞情报的分析，我们差不多知道了这个漏洞的来龙去脉：

1.  通过控制fetch 方法中$templateFile变量，将payload写入log文件

2.  通过assign_resume_tpl方法包含这个存在payload的log文件

首先我们抛开怎么把payload写入log文件，先来看看文件包含漏洞怎么回事。

经过上文的猜测，我们可以通过assign_resume_tpl方法包含任意文件。首先我们要看看怎么通过请求调用assign_resume_tpl方法

### 如何访问assign_resume_tpl方法

assign_resume_tpl方法位于common模块base控制器下。通过对Thinkphp路由的了解，assign_resume_tpl方法多半是用如下url进行调用

<http://127.0.0.1//74cms/index.php?m=common&c=base&a=assign_resume_tpl>

但是实际上，程序抛出了个错误

![9444960329c91727ea6dbec7b20fa1cb.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110055-c2bc7b0c-3513-1.png)

这是为什么呢？经过动态调试发现一个有意思的事情：common模块是并不能被直接调用的。原因如下：

\\ThinkPHP\\Library\\Think\\Dispatcher.class.php中存在如下代码

![88af447596e2829c4411f28661b542a8.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110105-c8b4f08e-3513-1.png)

从上图代码可见，因为我们common模块位于MODULE_DENY_LIST中，因此不能直接通过m=common来调用common模块。

既然不能直接调用，看看有没有其他的办法调用common模块base控制器下的assign_resume_tpl方法

经过研究发现，几乎所有其他的控制器，最终都继承自common模块的BaseController控制器

我们拿Home模块的AbcController控制器举例,见下图：

![403e42518385b162d794fb3b941c6388.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110113-cda5eed6-3513-1.png)

AbcController 继承FrontendController

![35b39ce4673b5ade1e2497dcb94bd0a0.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110122-d2c14c94-3513-1.png)

而FrontendController由继承了BaseController

因此可以通过get请求

http://127.0.0.1/74cms/index.php?m=home&c=abc&a=assign_resume_tpl&variable=1&tpl=2

来调用BaseController下的assign_resume_tpl，并将$variable=1、$tpl=2参数传递进去

![a2172aab27f3ef1b48b7af9163c7bcdd.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110132-d9051f7c-3513-1.png)

同理，Home模块下的IndexController控制器也是可以的，见下图

![71a84a69aed01a87e4f773c16074ea41.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110143-df9d869e-3513-1.png)

IndexController继承FrontendController，从上文可知，FrontendController继承BaseController。因此也可以通过get请求

http://127.0.0.1/74cms/index.php?m=home&c=index&a=assign_resume_tpl&variable=1&tpl=2

来访问BaseController下的assign_resume_tpl并向该方法传参

![b1d60a095246236ff99c0ff8b4210fed.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110154-e5bf046c-3513-1.png)

我们后续分析就用

<http://127.0.0.1/74cms/index.php?m=home&c=index&a=assign_resume_tpl&variable=xxx&tpl=xxx>

这样的形式调用assign_resume_tpl方法

既然我们可以通过请求向存在漏洞的assign_resume_tpl方法传参了，距离漏洞利用成功已经不远了

### 用测试文件触发文件包含

我们接下来”假装”在后台上传一个payload，用assign_resume_tpl这个接口包含下试试

笔者手动在如下目录里放了个test.html

![94f079c4ee2149e6f76d6c77c7b6d256.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110205-ecc6849c-3513-1.png)

为什么这么放呢？因为笔者在源代码里看到如下代码

![69df56ea206c171eef4e1aa43e51b167.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110215-f2aa2bde-3513-1.png)

这里是74cms使用assign_resume_tpl调用word_resume.html的形式。因此笔者在测试时也在word_resume.html通目录下放置了一个test.html，其内容如下：

![11ba75fcfd04e5eae60d9888468b9048.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110225-f8990286-3513-1.png)

构造如下请求

<http://127.0.0.1/74cms/index.php?m=home&c=index&a=assign_resume_tpl&variable=1&tpl=Emailtpl/test>

请求将调用assign_resume_tpl方法。动态调试过程如下：

![7cb8badae382c35d54466000a3b9441f.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110236-fee339ae-3513-1.png)

可见此时$tpl为Emailtpl/test，get请求中参数成功传入了。

我们来看一下fetch里怎么实现的

![6b99d80ecb0f333ed74925335e0ec179.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110247-0573872e-3514-1.png)

程序会执行到fetch方法中的Hook::listen('view_parse',$params);代码处

![c036dd43047a181f550626ad8df457c2.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110256-0b31ebc4-3514-1.png)

此处代码很关键，需要详细说明下。Hook::listen('view_parse',$params);这处代码的作用大体上有两个：

1.  Compiler：将模板文件经过一定解析与编译，生成缓存文件xxx.php

2.  Load：通过include方法加载上一步生成的xxx.php缓存文件

简而言之，Hook::listen('view_parse',$params);先通过Compiler将攻击者传入的模板文件编译为一个缓存文件，随后调用Load加载这个编译好的缓存文件。

首先我们来看下生产缓存文件过程

#### Compiler

![31a5ff3300343ac374148a72a0dd8588.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110309-12ac0bf0-3514-1.png)

从Hook::listen('view_parse',$params);到compiler方法的调用链如下：

![64891519910e85a6a42ac40810be6e9d.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110317-17b311b6-3514-1.png)

该方法会将thinkphp的html模板中定义的标签，解析成php代码。例如模板中的”<qscms:company_show/>”

就会被解析成

![8e827252d1f78414700cd630ab754864.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110328-1e5321e6-3514-1.png)

除此之外，compiler方法还会将生成的xxx.php文件头部加上一个如下代码以防止该文件被直接执行

```php
<?php if (!defined('THINK_PATH')) exit();
```

说完compiler方法的功能后，我们来看下compiler方法是如何处理我们的test.html。

test.html中的代码为<?php phpinfo(); ?>，经过解析之后，返回值见下图

![b480be6cff72222f2025bbfd2b65271c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110340-24f31b78-3514-1.png)

上图compiler方法最终返回的是strip_whitespace($tmplContent);

但strip_whitespace方法的作用是去除代码中的空白和注释，对我们的payload没什么实际意义。

最终compiler方法返回值为

```php
<?php if (!defined('THINK_PATH')) exit(); phpinfo();?>
```

这个值被写入一个缓存文件，见下图

![11b8744f27297b10d84cf708057b471c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110350-2b54b5e4-3514-1.png)

缓存文件位于data/Runtime/Cache/Home/8a848d32ad6f6040d5461bb8b5f65eb0.php

![c3c54d062abc49548ea48afbc33395f0.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110401-31cd5854-3514-1.png)

到此为止，compiler流程已经结束，我们接下来看看加载过程

#### Load

Load代码如下图所示

![7aa85eb5ad15da842e9171513ad2f150.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110412-38878160-3514-1.png)

从Hook::listen('view_parse',$params);到load方法的调用链如下：

![70c4e79c2d0424fe398992dcf91af922.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110422-3e51db7c-3514-1.png)

从第一张图可见，load代码最终会include 我们compiler流程中生产的那个data/Runtime/Cache/Home/8a848d32ad6f6040d5461bb8b5f65eb0.php缓存文件

当8a848d32ad6f6040d5461bb8b5f65eb0.php被include之后，其中的恶意代码执行，见下图

![e3686e2479975e1820d9cf36fd58f907.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110435-463a4388-3514-1.png)

执行成功后，浏览器如下

![16c7ecd9e2af85defd979531b5030000.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110448-4dadbe6a-3514-1.png)

等等，为什么没有phpinfo的回显呢？是不是我们phpinfo执行失败了？我们换一个payload试试，见下图

![af7dd12134991a71b0e6e926fb19b233.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110457-5309232c-3514-1.png)

这次我们执行一个生产目录的命令

![db01c632208c94ae46df30b87b5cf5a7.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110507-5912f4dc-3514-1.png)

可见命令执行成功了。但是为什么phpinfo没有回显呢？

### phpinfo回显哪去了

从上文看，我们使用测试文件进行包含利用成功了，但是phpinfo的回显却不见了。进过研究发现，原因还是在fetch方法里。在fetch中，注意看下图红框处代码：

![b90c07a43bcf7ba6245dfcea7d6eecdc.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110517-5eea7876-3514-1.png)

Fetch中的load流程，即加载payload执行phpinfo的过程在上图126行处Hook::listen('view_parse',$params);代码中完成的。

而在此之前，程序通过ob_start打开缓冲区，因此phpinfo输出的信息被存储于缓冲区内，而在Hook::listen代码执行之后，又通过ob_get_clean将缓冲区里的内容取出赋值给$content并删除当前输出缓冲区。因此phpinfo虽然执行成功，但回显并不会显示在浏览器页面上。

如果想要获取回显，我们该怎么办呢？这其实很简单，见下图

![eeedcef07c82e7e4b1dd41dcfac688d8.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110526-6430b02a-3514-1.png)

此时生成的缓存文件如下：

![caa1ebf3c9864c988ac9783ed13927b2.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110537-6ab84098-3514-1.png)

虽然在include这个缓存文件之前，程序通过ob_start打开缓冲区将phpinfo的输出存到缓冲区里，但我们可以通过执行ob_flush冲刷出（送出）输出缓冲区中的内容，打印到浏览器页面上

![62bd36b0497018cf2b3057ed3a02fe03.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110546-70186428-3514-1.png)

### 怎么将payload写入文件

上文我们一直在用一个手动上传的test.html，很显然这在实际漏洞利用过程中是不行的。我们需要想办法在目标服务器里写入一个payload。

在这里笔者绕了很多弯路，尝试着在图片上传处做文章，但最后失败了。后来笔者突然想起来官方的补丁，还记得上文我们从官方补丁中得到的漏洞情报？

补丁将fetch 方法中

```php
if(!is_file($templateFile)) E(L('_TEMPLATE_NOT_EXIST_').':'.$templateFile);
```

代码注释替换为

```php
if(!is_file($templateFile)) E(L('_TEMPLATE_NOT_EXIST_'));
```

修改之处的E()函数是用来抛出异常处理的，而补丁将$templateFile删除，正是不想让$templateFile变量值写到日志log文件中。看来payload是可以写到日志文件里的。

我们回过头来，看看fetch 方法中$templateFile变量怎么控制

![1d8138dd946fd4cc7c4f2ecca308cbb1.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110558-7795157a-3514-1.png)

还记得上文的分析吗？$templateFile变量其实就是请求中传入的tpl变量可以被攻击者控制。从上图来看，只要请求中传入的tpl变量不是文件，就可以将tpl变量值写入log文件。

那么我们就让请求中传入的tpl变量为payload字符串，满足不是文件判断，让这个payload写到日志中

实际发送如下请求控制$templateFile变量写入日志文件

![55762aad4cd5dd4ca2a9fd0bc211cd10.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110608-7d9bf60a-3514-1.png)

动态调试如下：

![1c6571b6153d1413b5ce3546c814146c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110618-834badac-3514-1.png)

日志被写到data/Runtime/Logs/Home/20_12_02.log，见下图

![896e4c9fd287cb6cf3182bdde9a1293c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110628-8934c08c-3514-1.png)

但有个问题：我们为什么不像上文一贯作风，使用get请求传递tpl变量值呢？因为从get请求中url会在日志文件中被url编码，而post请求则不然。因此只能发送post请求。

到此，完整的利用链构造出来了，发送如下请求即可包含日志文件并执行payload

![308216e7581d00fbadf496dc6b2beeb8.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110640-90c3f502-3514-1.png)

写在最后
--------

总得来说这个漏洞并不复杂，但是却很巧妙。在此过程中遇到很多有趣是问题。

### 构造图片payload问题

在从官方补丁中发现利用log文件写入payload思路之前，笔者花费大量时间尝试利用图片上传写入payload。因为74cms中利用了ThinkImage(也就是php-GD)对图片的渲染和处理导致webshell代码错位失效，笔者尝试了这篇文章里的思路

<https://paper.seebug.org/387/#2-bypass-php-gdwebshell>

这下倒是成功了一半：ThinkImage出现异常抛出错误了，并没有对笔者webshell图片进行渲染和处理，这看起来太棒了。但坏消息是，因为ThinkImage抛出异常，程序并没有把笔者上传成功后存储于服务器上的图片名称抛出来，而图片名称是通过uniqid()函数生成的随机数。uniqid() 函数基于以微秒计的当前时间，生成一个唯一的ID。笔者也没有办法猜测出上传后的图片名是什么，因此作罢。

这个问题与接下来的问题相关，也就是官方的补丁到底有没有效

### 官方第一处补丁到底有没有用

还记得上文漏洞情报分析那里，关于第一处补丁笔者的分析吗？

补丁在assign_resume_tpl方法中增添了如下代码

```php
$tpl_file = $view->parseTemplate($tpl);

if(!is_file($tpl_file)){

return false;

}
```

笔者在分析漏洞之前的想法是：因为这是一个文件包含漏洞，而assign_resume_tpl方法正是这个漏洞的入口，因此如果我们传入的$tpl必定是一个文件，这样可以轻松的绕过$view->parseTemplate($tpl);（parseTemplate中进行判断，如果传入的tpl是文件则直接return）与if(!is_file($tpl_file))判断。

但经过深入的漏洞分析发现，assign_resume_tpl方法不仅是文件包含漏洞的入口，也是后续将payload写入log文件的接口，通过控制assign_resume_tpl方法的tpl参数为字符串形式的payload，则这个payload将会在fetch中被写入日志文件。

![b7434e7d568331a5078aae73e61415ae.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110703-9e43bf64-3514-1.png)

但在assign_resume_tpl方法中增加了判断

![3b42f29aa73f0b0a718cbc2ebf766527.png](https://xzfile.aliyuncs.com/media/upload/picture/20201203110719-a7791f48-3514-1.png)

$tpl_file会是payload字符串拼接.html这样的形式，接下来的if(!is_file($tpl_file))会return false，而保护程序不进入fetch。

但这样真有必要吗？因为fetch中也打了补丁，经过上文对补丁的分析，就算是assign_resume_tpl方法中没有修改使得payload进入了fetch，由于补丁的原因fetch中也不会把payload写入日志了，因此这里的补丁显的没有太大必要。

### 官方补丁可以绕过吗

经过从上面两个问题的思考，可以发现一个新的问题，那就是官方补丁是否可以绕过。通过对漏洞的了解，官方补丁实际起作用的是不让payload写入日志文件。如果真的有人有办法在图片中写入payload并上传成功，在assign_resume_tpl方法中直接包含这个文件即可利用成功。assign_resume_tpl方法中的补丁并没有限制tpl参数为文件。

也就是说：要么官方补丁是可以轻松绕过的、要么通过构造图片webshell这条路走不通。具体哪个是对的，就要看看官方后续是否又出补丁绕过公告与一个新的补丁了。