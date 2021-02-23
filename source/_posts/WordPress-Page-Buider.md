---
title: WordPress Page Buider插件 CSRF to XSS漏洞分析
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/hacker-0509-scaled.jpg
date: 2020-06-01 17:26:05
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

前言
----

Page Builder by SiteOrigin是一个安装量超过100W的WordPress页面生成器插件，该插件可帮助用户使用基于小工具的页面生成器轻松构建响应式页面内容

![5602057ec16c195db947deaeadf92a3f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131117-5606d4ae-9a58-1.png)

近日wordfence安全人员披露了一个Page Builder by SiteOrigin2.10.15及以下版本中发现的严重安全漏洞：
CSRF to XSS。攻击者可以通过诱使WordPress站点管理员单击特制链接以触发该漏洞，成功利用该漏洞可以使攻击者创建一个新的管理员帐户并安装后门程序。

漏洞分析
--------

Page Builder bySiteOrigin插件内置一款实时编辑器，用户可以在观察实时更改的同时更新内容，这使得页面的编辑和设计或发布过程更加流畅。

![73dd0001f9a40c0dd939302755b258dc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131144-660a7004-9a58-1.png)

本次漏洞就是出现在该插件内置的实时编辑器中。

在编辑文章活页面时点击实时编辑器按钮即可使用此工具

![7351e25c7ebb5d4f207dbaaeade362ad.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131344-ad93a0e4-9a58-1.png)

在实时编辑器中可以实时预览编辑文章、添加小工具、修改页面布局等情况

![a213103a3a6cb4172e532d67f67f3c2a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131413-be9f0ed2-9a58-1.png)

以添加小工具功能为例，我们可以添加一个自定义HTML模块

![1c1a291adb947263670f8a86947ca3ad.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131535-efae288c-9a58-1.png)

在这个模块中添加一些内容

![472cbcf202a29d59843f46bb489665de.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131556-fc065b2c-9a58-1.png)

完成编辑后，用户的编辑效果可以实时呈现在编辑器浏览页面中

![990a7ad9885c8880cc91cfc27f7fad2f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131613-0619741e-9a59-1.png)

实时编辑器仅提供用户对草稿的编辑与预览。如果需要保存与发布，还需要点击Save Draft按钮

在了解了Page Builder by SiteOrigin插件的功能之后，再看一下后台是如何实现与如何产生漏洞的

当用户点击实时编辑器按钮后，会进入上文描述的实时编辑器页面

此时用户可以对页面进行一些编辑操作，当用户编辑完成后点击已完成按钮后，会向后台发送如下请求：

![82bbe64a16e3ee32ecf978ee845b7167.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131629-0f91a3e0-9a59-1.png)

url中p参数代表目前编辑的文章id，siteorigin_panels_live_editor=true代表目前正开启使用实时编辑器，live_editor_panels_data参数值为修改后的页面数据

可以跟进插件后台看一下代码

![68e36c1e7f20d7bae9cf09087a174f8a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131642-1776070e-9a59-1.png)

程序通过is_live_editor来判断是否使用实时编辑器

我们接下来看一下is_live_editor函数

![0b4b5b8be223fa7cb5bf47ea4b2b577c.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131656-1f928516-9a59-1.png)

is_live_editor函数的作用是检查用户是否在前端的实时编辑器中，当用户提交的请求url中siteorigin_panels_live_editor不为空时，则判断用户正在使用实时编辑器

接着，程序调用SiteOrigin_Panels_Live_Editor::single()函数包含实时编辑器文件

![7dd3f387c593c990ece8059b4464ba0c.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131710-2815bdde-9a59-1.png)

![eb39bfca06d4eae5db39268f5d09d644.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131728-32e65930-9a59-1.png)

在SiteOrigin_Panels_Live_Editor类的构造方法中，通过add_action函数将post_metadata函数挂载到get_post_metadata hook上

![bf43da4c2fa9dfad1d0dfb1bd9663950.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131746-3dd956b2-9a59-1.png)

get_{\$meta_type}_metadata hook用以处理动态部分\$meta_type指定的元数据类型并获取元数据，这里是用来获取挂载的post_metadata函数返回的元数据

接下来看一下post_metadata函数

![f028fa52603ac0e7de9b9c573a374e80.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131804-48a1cda4-9a59-1.png)

在post_metadata函数中，对访问实时编辑器的用户身份、提交的跟新信息等进行校验，通过校验的数据可以进行后续处理并返回元数据。但post_metadata函数并没有通过校验csrf token来保护提交数据的来源合法性。这将导致csrf漏洞的产生。

在通过一系列的校验后，程序将live_editor_panels_data参数提交的页面信息进行加工并进行渲染工作。程序使用add_filter('the_content', string \$content )实现页面内容加工工作,然后再将其打印到屏幕上

![e27d11a730e2ba6beb5a6d4e6c019ca1.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131819-518c34cc-9a59-1.png)

这里用来加工页面信息的函数是generate_post_content

![a771f883323d14de0ef0cd34ce838962.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131833-59c25ae0-9a59-1.png)

最终，live_editor_panels_data参数中提交的新的页面信息将会被打印到屏幕上

需要特别注意的是，此插件实施编辑器中有如下代码

![d1d8a87cd2a479746720dd5e8a9cd597.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131846-6194c69a-9a59-1.png)

![7cf98e32bee7a7eb769f09b247cda67c.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131858-686a9242-9a59-1.png)

实时编辑器通过header( 'X-XSS-Protection: 0');设置X-XSS-Protection响应头以关闭浏览器XSS保护。可见这个插件的实时编辑器页面中允许xss的触发。

漏洞利用
--------

构造实时编辑提交页面修改的数据包

![601baa1f13ba0af8c8d6e4426c7eac3e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131914-722ee72e-9a59-1.png)

将其中的content字段改为xss payload

![e26acd21aa9b11b8a28a89d88f86c14b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131929-7afc2a56-9a59-1.png)

生成csrf poc

![857c91104eb61fd5b71f62db54854b97.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131943-831cce3e-9a59-1.png)

当管理员访问该poc页面时，xss触发

![cef52538169f1a0787b579875c258868.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520131957-8bcf5f60-9a59-1.png)

通过xss漏洞，可以构造payload进行进一步的攻击，例如添加一个管理员账号。

修复
----

在新版live-editor.php文件的xss_headers函数中加入了wp_verify_nonce()函数对nonce进行校验

![697a9fe96436a57113323029bc56a45e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200520132010-939c214c-9a59-1.png)

这一措施可以有效的防范csrf漏洞的产生