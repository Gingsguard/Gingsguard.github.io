---
title: WordPress-Social-Warfare远程代码执行漏洞分析
date: 2019-09-24 17:49:58
tags: web漏洞分析
categories: 技术
---

------

<div align="center">{% asset_img 1.png%}</div>

social-warfare是一款 WordPress社交分享按钮插件。 该插件被wordpress用户广泛的应用： 从官网看，该插件官方的统计是超过90万的下载量

social-warfare &lt;= 3.5.2版本中，程序没有对传入参数进行严格控制以及过滤，导致攻击者可构造恶意payload，无需后台权限，直接造成远程命令执行漏洞

<!--more-->

# 背景介绍

social-warfare是一款 WordPress社交分享按钮插件。 不同于大多数WordPress社交分享插件，social-warfar最大的优势在于其轻便性与高效性。它不会像其他共享插件一样减慢网站速度，这也是很多用户使用其作为自己网站社交分享插件的原因。

该插件被wordpress用户广泛的应用： 从官网看，该插件官方的统计是超过90万的下载量

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/9cab96ac7dc5a8c199faa4cea800d35b.png)

## 漏洞描述

social-warfare &lt;= 3.5.2版本中，程序没有对传入参数进行严格控制以及过滤，导致攻击者可构造恶意payload，无需后台权限，直接造成远程命令执行漏洞。

攻击成功的条件只需要如下两条：

只要符合以上两个条件，无需复杂的payload构造，即可通过简简单单的一个get请求，远程执行任意代码。
与wordpress自身漏洞修补不同，对于插件的漏洞，wordpress并不会在后台对该插件进行自动升级，仅仅是提示有新版本可用。

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/f09cfb9a4bf7ca3a89624bbdab4ece3a.png)

简言之，由于该机制的存在，目前还有大部分使用该插件的站长，所使用着仍存在漏洞版本的social-warfare插件，面临着被攻击的风险。

与此同时，这个漏洞，还是一个洞中洞，开发者的一连串失误，将该漏洞威胁等级逐步增高。

&nbsp;

## 受影响的系统版本

social-warfare&lt;= 3.5.2

&nbsp;

## 漏洞编号

CVE-2019-9978

&nbsp;

# 漏洞细节

social-warfare安装后如下图

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/6cea63341fcc7d1afae9189460553fb4.png)

如图中红框所见，该插件提供了一个简洁易用的分享功能栏。

首先，通过github的commit记录，找到漏洞触发点

漏洞触发点位于/wp-content/plugins/social-warfare-3.5.2/lib/utilities/SWP_Database_Migration.php中的debug_parameters方法中

首先分析下debug_parameters方法

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/9a7ba07b0bc7379abc39d0dc734bef4d.png)

该方法提供了一种允许更容易调试数据库迁移功能的方法。

先来看下get_user_options功能的代码块

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/4e04fc9b7265e54c0e15a3635fc5874b.png)

此处功能模块加载wp-content/plugins/social-warfare-3.5.2/lib/utilities/SWP_Database_Migration.php 中initialize_database方法中的$defaults数组中的配置信息，如下图

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/19b94966c0e303f8164286461e0338e2.png)

在访问与执行该功能模块后，返回相应的配置信息

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/fcd76e490cc82b1d1ca222c7fc4727b7.png)

接下来分析漏洞触发点 位于如下图中的if分支中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/34a240e81557704f1c9745d6080e23ad.png)

也就是在’load_options’这个功能模块中。该功能模块，是开发者用来调试数据库迁移功能的，在对用户实现实际的业务功能中，该模块并没有被使用过。

逐行分析下此功能模块 首先，可以看到如下图代码块:

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/9a74d7ee9fd35b14d8f9ef267f87fd38.png)

如红框中所见，这里的代码看起来，需要通过is_admin()方法的校验。看起来，这里需要有admin权限才可以执行后续代码触发漏洞。按照以往经验，这是一个需要后台权限才可以代码执行的漏洞（但这里的推测并不正确，具体的见下文分析）

紧接着，通过file_get_contents方法，发送请求

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/17cbe28ee96c48c8baab35742002bf3d.png)

其中的$_GET[‘swp_url’]我们可控，例如：

http://127.0.0

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/0594cb2ffa6f8a291c0ba8d41e1e5668.png)

这样file_get_contents会访问 http://127.0.0.1/1.php?swp_debug=get_user_options，并将我们构造好的payload传递给$options变量 到此为止，我们通过构造链接传入file_get_contents，达到完全可控$options变量中的内容的目的

接下来，会从$options变量中提取出内容，并进行解析，如下图

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/bded25e5da4ccfa0f16d614b52548839.png)

随后，将解析出的$options值拼接后赋予$array，如使用我们案例中的1.php,那么$array的值为：return phpinfo()

接下来，$array中的值会传递入eval中，造成代码执行

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/dd061c81db5e40245e4458ff5f8bc8ba.png)

实际效果如下图

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/66a4b42781354e24b2cde9e630f51bb1.png)

漏洞分析到此结束，本次漏洞影响很大，但漏洞自身没有什么亮点

接下来，看一下官方是如何修补的：

通过github的commit记录，获取此次的修补方案。

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/a134e944bfa46ae34edb4d687d33f597.png)

此次修补，将lib/utilities/SWP_Database_Migration.php中的221-284行，将debug_parameters方法中存在问题的load_options模块代码全部删除 所以不存在绕过补丁的可能性。

在分析此漏洞时，有几处有意思的地方，和大家分享一下：

### 思考一：

先来看下如下操作：

首先，我们退出wordpress登陆

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/0dba144a1bc952bc4cda36f0cce39b6c.png)

可见，此时我们并没有登陆，也没有admin权限

接着，我们访问poc

http://127.0.0.1/wordpress/wp-admin/admin-post.php?swp_debug=load_options&amp;swp_url=http://127.0.0.1/1.php

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/650252922e64b757e1d7c89b063cc305.png)

payload仍然可以触发

回顾上文此处

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/9a74d7ee9fd35b14d8f9ef267f87fd38.png)

在漏洞分析环节，我们的猜测是，由于is_admin方法的校验，此处应该是后台漏洞，但是在没有登陆的情况下，仍然触发了。

这是为什么呢？

原因如下： 先来看看is_admin方法是如何实现的

位于/wp-includes/load.php中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/de06cb5281ce8f86eff50fab3c185a22.png)

可以看到，有一个if-elseif判断

在elseif中判断defined (‘WP_ADMIN’)的值

由于我们构造的payload，入口是admin-post.php

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/0fed2e5c53e4edde5b9d93f2048793d6.png)

看一下admin-post.php 第3行将WP_ADMIN定义为true

也就是说，is_admin方法，检查的是：此时运行时常量WP_ADMIN的值是否为true。

在wordpress中，WP_ADMIN只是用来标识该文件是否为后台文件。大多数后台文件，都会在脚本中定义WP_ADMIN为true(例如wp-admin目录下的admin-post.php等)， 因此is_admin方法检测通过时，只能说明此是通过后台文件作为入口，调用debug_parameters方法，并不能有效的验证此时访问者的身份是否是admin

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/33f902eec67376c6d25e3d0dd6a9fb5f.png)

前台index.php无法触发

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/f4c0cca46dd5d5fc3b030c0551588024.png)

wp-admin目录下的about.php可以触发

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/2cc7e92daa9871394958530b342e44df.png)

可见，wp-admin下任意文件为入口，都可以触发该漏洞，也就是说，在构造payload以及进行防护时，需要注意

http://127.0.0.1/wordpress/wp-admin/[xxx].php?swp_debug=load_options&amp;swp_url=http://127.0.0.1/1.php

这里xxx可以是绝大多数后台php文件

### 思考二：

访问http://127.0.0.1/wordpress/index.php?swp_debug=get_user_options 时，是如何将get请求中的swp_debug=get_user_options与get_user_options功能模块关联起来，调用此功能模块执行相应的功能呢？

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/c63a5db2ef1357c6fb1c0c176eb5195f.png)

同理，当访问http://127.0.0.1/wordpress/index.php?swp_debug=load_options 时，后台是如何解析get请求，并找到load_options模块的？

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/9d224e3ea0e9aff4641c2f37250366e1.png)

开始的时候，笔者以为是有相关的路由配置(类似于django中的url解析)，或者说是类似MVC结构中的控制器（类似thinkphp中的url普通模式http://localhost/?m=home&amp;c=user&amp;a=login&amp;var=value）这样的结构，但实际真相很简单：

见下图，SWP_Utility::debug方法

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/d8e014b47e8d8c511fb6f6ef359efe43.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/05/f416a39a73e5de93a96b836bf844b57a.png)

在debug_parameters方法中的所有if分支中逐个执行debug方法，逐个将debug方法内注册的值（’load_options’、’get_user_options’等）和get请求中swp_debug的值进行比较，如果一样，则执行该功能模块的代码，如果不一样，则进入下个if中。道理同等于switch
