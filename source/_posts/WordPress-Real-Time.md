---
title: WordPress Real-Time Find and Replace插件CSRF to Stored XSS漏洞分析
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/SDP下一代的企业访问控制方法.jpg
date: 2020-05-13 17:20:12
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

前言
----

Real-Time Find and Replace是一个可以实时查找和替换WordPress网页数据的插件。据统计，该漏洞已安装在100,000多个站点上。

近日Real-Time Find and Replace 3.9版本被披露存在一处高度严重的安全问题：由于Real-Time Find andReplace的核心功能模块并没有采用随机数来校验请求的合法性，从而导致跨站点请求伪造（CSRF）漏洞的产生。攻击者可以利用此漏洞，使用恶意代码替换目标站点页面上的任何内容。

漏洞分析
--------

### 预备知识

这一部分是对本次漏洞分析过程中涉及到的WordPress一些函数与机制的介绍，如果对WordPress很了解可以直接跳过

#### Real-Time Find and Replace插件是如何注册的

首先分析下Real-Time Find and Replace插件是如何注册到wordpress的菜单栏中的，以及WordPress是如何调用该插件

real-time-find-and-replace插件代码很少，只有一个php文件real-time-find-and-replace.php

首先看wp-content\\plugins\\real-time-find-and-replace\\real-time-find-and-replace.php 17行处的far_add_pages方法，该方法中使用add_submenu_page方法对wordpress的顶级菜单添加子菜单

![a7c7059870cfb1d648bc0bb65436a0e4.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164531-f3045c08-8abe-1.png)

add_submenu_page方法的参数说明如下

![bbf929c1d7c8d3c0d60c8e4170c3319f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164548-fd754fb2-8abe-1.png)

parent_slug- 父菜单的子名称（或标准WordPress管理页面的文件名）
page_title- 选择菜单后在页面标题标签中显示的文本
menu_title- 菜单中使用的文本
capability- 向用户显示此菜单所需的功能
menu_slug- 别名，用于引用此菜单
function- 用于输出此页面内容的函数

这里重点看下parent_slug参数和function参数

![7b72b94b45d31844c223a48c831460cf.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164607-08b7170c-8abf-1.png)

parent_slug参数值为tools.php 因此这里是在工具菜单栏处添加此子菜单

![ca6773d2b4c3d18c8ff498daaf4fb49e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164625-136c81d2-8abf-1.png)

从后台页面显示结果来看，的确如此

除此之外，通过parent_slug参数，可以在如下不同位置添加子菜单
1、在仪表盘菜单处: add_submenu_page( 'index.php', … );
2、在文章菜单处: add_submenu_page( 'edit.php', … );
3、在媒体菜单处: add_submenu_page( 'upload.php', … );
4、在链接菜单处: add_submenu_page( 'link-manager.php', … );
5、在页面菜单处: add_submenu_page( 'edit.php?post_type=page', … );
6、在评论菜单处: add_submenu_page( 'edit-comments.php', … );
7、在自定义文章类型菜单处: add_submenu_page('edit.php?post_type=your_post_type',…)
8、在外观菜单处: add_submenu_page( 'themes.php', … );
9、在插件菜单处: add_submenu_page( 'plugins.php', … );
10、在用户菜单处: add_submenu_page( 'users.php', … );
11、在工具菜单处: add_submenu_page( 'tools.php', … );
12、在设置菜单处: add_submenu_page( 'options-general.php', … );

接着来看add_submenu_page方法的function参数：

function参数指定用于输出此页面内容的函数。这里指定的是far_options_page，也就是要用far_options_page来输出页面信息

关于add_submenu_page方法需要了解的就这么多，继续往下看

![72da527a711d6c435a6714f6a7e007ba.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164647-2070a782-8abf-1.png)

可见19行有一处add_action( "admin_print_scripts-\$page", 'far_admin_scripts');代码
接下来介绍下add_action的首参，admin_print_scripts-\$page是什么
\$page是add_submenu_page方法的返回值，add_submenu_page方法在添加子菜单成功后，会将子菜单的对应页面的page_hook作为返回值返回

![757f1f960384127672baf4b7e2147074.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164704-2a7cbbd0-8abf-1.png)

这里的\$page值为tools_page_real-time-find-and-replace。使用add_submenu_page方法注册的子菜单page_hook都是唯一的，程序也是通过这个值来区分我们注册的不同页面

如果想理解admin_print_scripts-(page_hook)，不妨先看看和它很相似的admin_print_script方法：

admin_print_scripts方法用来给WordPress后台页面引入js与css文件。使用这个钩子会在所有WordPress后台页面中引入js与css文件。

实际操作中往往不需要在WordPress后台所有页面中加载同一组js与css文件，而是在指定页面中引入指定的js或css文件，这里就需要使用admin_print_scripts-(page_hook)方法。

admin_print_scripts-(page_hook)方法中的page_hook部分指定了需要加载js或css文件的页面。在这个插件代码中，通过add_action("admin_print_scripts-\$page", 'far_admin_scripts'
);在admin_print_scripts-tools_page_real-time-find-and-replace页面中加载far_admin_scripts函数，而far_admin_scripts函数中指定了要引入的js与css文件，见下图

![905f66c00b87f1a6ef28bf05c68dc57a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164719-33638274-8abf-1.png)

引入的这些js与css文件，将在add_submenu_page方法function参数渲染生成页面时生效。

在弄清楚插件是如何注册后，通过访问工具菜单栏中的real-time-find-and-replace子菜单，即可进入存在漏洞的页面，该页面即为far_options_page函数加载far_admin_scripts函数中引入的js与css文件后所渲染的结果

![d88fef128adca1bf8e50571a515b22f8.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164734-3c5dee8c-8abf-1.png)

#### Real-Time Find and Replace插件是如何工作的

这一部分比较有意思。在看代码之前，通过Real-Time Find and Replace插件的介绍来看，这个插件可以实时查找和替换网站页面中的数据。但这一点是如何做到的呢？我一度以为这个插件可以遍历读取所有的页面文件，对文件内容直接进行搜索与替换，但这样实现未免太繁琐了。

跟踪代码可以发现，实际的实现很巧妙。
wp-content\\plugins\\real-time-find-and-replace\\real-time-find-and-replace.php中可看到下列代码

![26bc22727d784d8be2f85d642f5ef4ac.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164748-44eb0e0e-8abf-1.png)

在real-time-find-and-replace.php文件代码的最后一行，通过add_action将far_template_redirect函数连接到template_redirect钩子上。template_redirect钩子将会在显示所请求页面的模板文件前执行，以便插件改写对模板文件的选择。

接着看下far_template_redirect函数

![9bdb6ec554c9201d061921dcc47d1a49.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164803-4de5b928-8abf-1.png)

far_template_redirect中使用ob_start函数打开输出缓冲区，将所请求页面的模板文件信息保存在输出缓冲区中,并使用far_ob_call函数处理输出结果。

far_ob_call函数对所请求页面的模板文件内容进行搜索与替换

![f8378a24d0122989baa092ab5476883a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164817-561c5688-8abf-1.png)

因此最终输出的页面中内容被修改，但是页面文件自身并不会被修改

### 进入正题

通过预备知识部分可知real-time-find-and-replace插件是如何在工具菜单注册的子菜单、页面是如何渲染和以及如何工作的。与预备知识相比之下，本次漏洞就显得比较简单

本次漏洞就出在了real-time-find-and-replace插件管理页面，该页面提供了wordpress页面全局搜索与替换的功能

![b604e176acd9407f201e540c7bf1d022.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164838-62a85690-8abf-1.png)

执行完毕之后，wordpress中所有\<head\>在输出时将会被替换

![09035470d5a809820349ff1442060920.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164852-6a9cec4e-8abf-1.png)

从下图代码可见替换后的结果

![13c1b3baeadfb1ab8ddff270113f18ec.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164904-72304adc-8abf-1.png)

这个功能虽然很强大，但正常情况下也只有管理员才可以使用这个功能

我们抓一个替换操作的数据包来分析下

![4f03d99860e03e628e393768df90fd7e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164917-79ce011c-8abf-1.png)

Post提交的数据中仅仅包含替换相关的属性值，并没有csrf token

![d0c3f27ffc8ef673e2b297882cea5873.png](https://xzfile.aliyuncs.com/media/upload/picture/20200430164933-8352a3be-8abf-1.png)

从上图代码中也可以看到，这个功能并没有校验csrf token。攻击者可以伪造连接诱骗管理员点击，通过csrf攻击使管理员发送请求使用real-time-find-and-replace插件提供的功能，用新内容或恶意代码替换网站上的任何页面信息。当攻击成功后，浏览任意页面均可受到攻击。

总结
----

开发者一个小小的疏忽，往往会导致很严重的后果。漏洞成因很简单，但是影响还是比较严重的。