---
title: WordPress 5.0.0 远程代码执行漏洞分析（CVE-2019-8942、CVE-2019-8943）
date: 2019-02-21 17:03:02
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

近日，wordpress发布一个安全升级补丁，修复了一个WordPress核心中的远程代码执行漏洞。代码修改细节可以参考wordpress团队于Dec  13, 2018提交的代码。据漏洞披露者文中所介绍，这个漏洞在WordPress核心中被发现已经超过6年。

<!--more-->



## 漏洞简介

1、此漏洞是由目录遍历以及本地文件包含两部分组成。

2、想要利用此漏洞，需要在目标WordPress站点上拥有至少作者权限访问帐户。

## 漏洞分析

这里主要分析CVE-2019-8943这处漏洞

首先看下目录遍历漏洞

 

首先上传一张图片

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/24e5f0ff2f3351ed0134bbb856d16874.png)

 

图片会被wordpress保存至wp-content/uploads目录，但与此同时，在wp_postmeta表中仍然会有该图片信息的记录，如下图

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/78dc3e09777f9ae9f4db08a52ee79ded.png)

在图片被编辑时

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/6bbc2289d23fd3eb92e9275c9e8eedca.png)

会向wordpress后台发送如下post请求，如下图

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/ca67b151b90c5460fb830be4a3ba78b8.png)

 

在处理post参数的过程中，有如下一处代码

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/4d92b4d12064f34f5cf42d8e63f8c339.png)

可以看到if条件中有一个方法：update_post_meta

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/40cc30845af91f96de8e6ee41e8a07bc.png)

这个方法的作用是基于POST ID更新POST元字段，也就是说通过。$post_ID, $field, $value来更新数据库中的信息  以下图为例

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/0444c22768de7644c2f318d9d3759aa1.png)

此例中

$post_ID:4  $field: _wp_attached_file $value: 2019/02/Chrysanthemum-e1550648854385.jpg

| 123  | $post_ID:4 $field: _wp_attached_file$value: 2019/02/Chrysanthemum-e1550648854385.jpg |
| ---- | ------------------------------------------------------------ |
|      |                                                              |

在正常的修改图片操作中，$postarr[meta_input]值会为空，但是可以构造payload使得篡改数据库中对应value的操作得以实现。

发送payload

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/6251818e1661de4bd6168841fbaef35b.png)

此时，$postarr[meta_input]中的key与value被遍历取出，数据库中内容被篡改

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/9c7e2868ccd0d1e78856a59d5f3461e9.png)

到此截止，我们已经成功的篡改了数据库中关于此图片文件的_wp_attached_file值，但是也是仅仅更改了数据库中的记载，文件系统中存储的实际文件名没有改变，对应的仍然是grq.jpg

接下来要进行的是目录穿越，向其他目录写入这个jpg文件

目录穿越漏洞位于wp_crop_image方法中

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/678397c9f695d5461fa2a31962b29ebb.png)

这个方法是用来剪裁图片。

需要注意的是，在wordpress中，如果直接在页面中点开一张图片，进行剪裁操作，如下图这样

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/14c7a71a6e40828c4cf822651676e2fb.png)

是根本不会调用wp_crop_image方法的。

这里一定要注意，我就是在这里被坑了很久

 

如果想触发漏洞，调用wp_crop_image方法，那么需要自己构造数据包。

当我们对图片进行剪裁变换等操作时，正常的数据包如下

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/8b5287ee628c79b726448ad684ae639f.png)

可以看到action=image-editor,

看下位于wp-admin\admin-ajax.php中的$core_actions_post数组

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/e4635806c566c0895fa89078e70b9fd5.png)

显而易见，想调用wp_crop_image方法，那action要为crop-image

 

构造数据包如下

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/3d04b7c6587be4d15e5681d63de191bb.png)

 

既然已经成功的进入了wp_coce_Image()方法，再来看看这个目录穿越是如何执行的。

当调用该函数时，函数首先调用get_attached_file方法中

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/678397c9f695d5461fa2a31962b29ebb.png)

get_attached_file方法通过id 寻找存在数据库中 _wp_attached_file字段的value如下图。

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/814ecb83c208192bf7d028119c2d4154.png)

这里需要提醒的是，_wp_attached_file字段中的内容我们已经通过之前步骤成功改为我们的payload，然后get_attached_file方法会将_wp_attached_file字段中的内容拼接$uploads[‘basedir’]作为图片的路径返回，这个路径会类似如下形式

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/ac817ce717dd53f9a96da32e305cfbbd.png)

C:\wamp64\www\wordpress4/wp-content/uploads/2019/022019/02/grq.jpg?../../evil.jpg

在得到了图片地址后

首先，wordpress将会直接加载这个地址，但显而易见，文件系统中根本无法找到这个文件。

 

当该方法失败后，WordPress将尝试从它自己的服务器下载图像。

如下图，在wp_get_attachment_url方法中

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/366b7c2ab1361f42d41135047c90a69f.png)

这时候的下载链接如下

> <http://127.0.0.1/wordpress4/wp-content/uploads/2019/02/grq.jpg?../../evil.jpg>

该URL由wp-content/uploads目录和由_wp_attached_file条目所提供的文件名组成

当http协议解析这个url时，grq.jpg后面的内容会被忽略，也就是说，可以正常找到并访问该图，如下图

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/0454096af13faef6893af40c1095a57d.png)

 

接下来，wp_coce_Image()方法会将此文件保存，但是在保存时，并没有对传入的参数进行校验，导致了目录穿越的产生

 

首先，先通过mkdir建立目录

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/90a1558d598dbba3e5034b6806a1c556.png)

其次，通过$editor->save将文件保存到生成目录中

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/cb4c9ea065e950e61f5870e38bf6a064.png)

此时我们通过构造的payload修改数据库中内容，使得其如下图形式

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/13154be252945d7998ee319cf050b5d4.png)

那么最终会在themes\currentactivetheme目录中生成我们的jpg

例如cropped-evil.jpg,因为是通过剪裁后的图片，会有一个cropped前缀

 

接下来就是代码执行部分

WordPress的主题位于wp-content /  themes目录中并为不同的案例提供模板文件。正常情况下，是无法通过web方式访问、写入此目录。但是截止此时，我们通过目录穿越，已经可以将我们的恶意图像文件插入此目录。然后通过加载这个themes，即可执行恶意构造好的图片payload，这个漏洞详情可CVE-2019-6977。 影响范围WordPress  before 4.9.9 and 5.x before 5.0.1

![img](http://blog.nsfocus.net/wp-content/uploads/2019/02/b9cdd3c4f038ec583307bcf4389d9c76.png)

## 影响范围

WordPress before 4.9.9 and 5.x before 5.0.1