---
title: 从一个简单的wordpress插件漏洞研究一下wordpress插件原理
date: 2019-09-15 14:27:41
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

在AdRotate Plugin5.2以及5.2之前的版本中，存在一处sql注入漏洞，该漏洞为FortiGuard实验室发现

<!--more-->

漏洞位于AdRotate Plugin的\dashboard\publisher\adverts-edit.php

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134445-1848c74e-d38e-1.png)
可见上图中，存在着多出sql查询语句

但是位于25行处，明显可见存在sql注入隐患

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134456-1eb7e6e6-d38e-1.png)
位于上图红框处，在拼接sql语句时，$ad_edit_id变量被拼接在id值部分。但是在这里，并没有用单引号将其值闭合

$ad_edit_id变量值可以通过get请求的方式传入，如下图

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134513-28cd777c-d38e-1.png)

位于上图173行，可见$ad_edit_id = esc_attr($_GET['ad']);

esc_attr方法是用来过滤HTML标签的，对sql注入无影响

esc_attr方法见下图

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134539-3896947c-d38e-1.png)

这样就导致了一个简单的sql注入的产生

具体的payload如下

```html
http://127.0.0.1/wordpress/wp-admin/admin.php?page=adrotate-ads&view=edit&ad=-1+UNION+SELECT+1%2CUSER%28%29%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1%2C1
```
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134552-4027b3d8-d38e-1.png)

这里是一个有回显的注入，数据库user被回显到name处，sql注入执行成功

漏洞分析到此结束，这个漏洞自身并没有什么亮点，不过在分析这个漏洞时，却发现了一些知识点

 

## 问题一、Wordpress是如何处理$_GET $_POST等请求

在上文分析的漏洞中，$ad_edit_id参数由$_GET['ad']获取

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134604-46f61ec0-d38e-1.png)

 

传入并拼接的sql语句中执行
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134618-4f6fbd18-d38e-1.png)

如果$ad_edit_id被单引号闭合呢？例如下图
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134630-569f59f4-d38e-1.png)
我们是否可以通过get传入单引号，闭合语句中的单引号并进行注入呢？

我们构造一个简单的payload测试下

```html
&ad=-1’
```
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134642-5dc0e428-d38e-1.png)

 

在adrotate_manage方法中下断
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134655-655ec272-d38e-1.png)
可见在adrotate_manage中的$_GET['ad']中的值，此时为”-1\’”
也就是说，我们传入的单引号在进入adrotate_manage方法之前，已经被wordpress转义


具体在什么位置被转义的呢？跟踪一下wordpress的代码
位于wp-includes\load.php中
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134709-6de5dd68-d38e-1.png)
由上图可见，wordpress将$_GET\$_POST\$_COOKIE\$_SERVER中的值，使用add_magic_quotes方法进行过滤
值得一提的是，随后，将过滤后的GET与POST数组合并后覆盖$_REQUEST。在以往一些安全性不高的程序中，往往会出现，过滤了GET与POST，却忘记过滤REQUEST的情况，导致漏洞的产生。


跟入add_magic_quotes方法
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134721-754300f4-d38e-1.png)
可见，该方法使用addslashes方法，将传入的键值过滤，因此我们传入的”-1’”被过滤为”-1\’”，可见wordpress在入口处是存在过滤机制的
这里引申出一个思考题(问题二)：


## 问题二：wordprss的这种过滤机制，是否仍然存在安全隐患

连接问题一，我们已经知道wordpress是如何处理请求的，即处理请求中的键值

如果一个插件开发过程中，存在如下的代码

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134735-7d44940c-d38e-1.png)
![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134751-86dc854c-d38e-1.png)
插件从请求中读取数组，然后通过INSERT方式将其插入数据库呢？

在这种情况下，可以在传入的键名中加入payload，如下图

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910134805-8f59a2ea-d38e-1.png)
页面sleep 5秒，sql注入成功
以上代码为以往漏洞挖掘中在其他程序中发现的真实案例，有兴趣可以参见
[从某cmsV4.1.0 sql注入漏洞看程序开发安全隐患](https://xz.aliyun.com/t/6237 "从某cmsV4.1.0 sql注入漏洞看程序开发安全隐患")
在开发wordpress插件时，会不会仍然有开发者犯下这样的错误呢？



## 问题三：wordpress是如何加载这个插件，我们如何构造利用链

我们的利用点位于wp-content\plugins\adrotate\dashboard\publisher\adverts-edit.php

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135233-2edf3cbc-d38f-1.png)

这个文件并没有定义与初始化一些变量，直接通过url访问这个地址，显然是不行的


![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135247-375fff7a-d38f-1.png)
查找adverts-edit.php在哪里被包含

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135259-3eb6cc0e-d38f-1.png)

跟到adrotate.php中，位于274行处，adrotate_manage方法中的if分支里

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135313-46d0e67c-d38f-1.png)

 

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135326-4eece2c0-d38f-1.png)

在adrotate_manage方法中，还可以看到$ad_edit_id变量被赋值的过程，见上图173行处

 

但是新的问题是，adrotate_manage方法是如何被wordpress调用的，我们怎样构造url才能执行adrotate_manage方法？

 

在adrotate.php106行处

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135342-58049592-d38f-1.png)

adrotate_manage作为参数传入add_submenu_page方法

我们来看下add_submenu_page方法

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135357-614c0a2c-d38f-1.png)

add_submenu_page()方法为后台顶级菜单添加子菜单，它的参数解释如下

`$parent_slug：`(字符串) (必须)顶级菜单名称，可以在顶级菜单中加入我们的子菜单，也可以在自定义顶级菜单中加入子菜单；（也就是 add_menu_page() 函数中的 $menu_slug 参数）

`$page_title：`(字符串) (必须) 这个参数是子菜单的标题，将会显示在浏览器的标题栏，默认为空；

`$menu_title：`(字符串) (必须) 显示的菜单名称，默认为空；

`$capability：`(字符串) (必须) 用户权限，定义了具有哪些权限的用户会看到这个子菜单（权限部分请看文章结尾处），默认为空；

`$menu_slug：`(字符串) (必须) 显示在URl上面的菜单名称，默认为空；

`$function：`所有调用的函数名称，通过调用这个函数来显示这个子菜单页面的内容。

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135411-69333b5c-d38f-1.png)

回到本插件中可以看到，在adrotate中，adrotate插件注册了一个名为Manage Adverts的子菜单，当点击此菜单时，将会执行adrotate_manage方法，此时url为
```html
http://127.0.0.1/wordpress/wp-admin/admin.php?page=adrotate-ads
```
page参数后面的值为add_submenu_page中$menu_slug的值

既然Manage Adverts为子菜单，那么它的顶级菜单是什么？

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135425-71f746ac-d38f-1.png)

可见，在上图103行处，存在一处add_menu_page方法，该方法定义了该插件的顶级菜单，名为AdRotate，访问url为
```html
http://127.0.0.1/wordpress/wp-admin/admin.php?page=adrotate
```
登录wordpress后台，安装好adrotate插件后，可见adrotate已经出现在菜单中，主次菜单名与url符合我们的预期

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135439-7a687522-d38f-1.png)

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135452-81db3042-d38f-1.png)

 

回头继续看代码，以上定义顶级菜单，子菜单的行为，都在adrotate_dashboard方法中

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135505-8975e8d8-d38f-1.png)

adrotate_dashboard方法是如何被wordpress加载的呢？

仍然在adrotate.php中

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135516-905213ca-d38f-1.png)

在上图77行处，adrotate_dashboard方法作为参数传递入add_action方法中

add_action方法的作用是将函数连接到指定action上。在这里，将adrotate_dashboard方法连接到admin_menu 钩子上

![](https://xzfile.aliyuncs.com/media/upload/picture/20190910135526-96578b38-d38f-1.png)

而admin_menu 钩子的作用是在管理员加载管理菜单之前触发所连接上的函数。

也就是说，在管理员加载管理菜单之前，我们的adrotate_dashboard方法会被加载，adrotate_dashboard方法中的代码被执行，所以我们的adrotate菜单被添加到管理页面的菜单栏中

 

## 后记

漏洞比较简单，但是分析wordpress机制的过程还是比较有意思的