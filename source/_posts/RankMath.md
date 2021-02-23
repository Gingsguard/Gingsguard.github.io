---
title: WordPress Rank Math SEO插件任意元数据修改漏洞分析
date: 2020-04-16 14:36:37
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5f6ca87fda316a1b5a989b5d286a918.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

Rank Math是一款旨在帮助搜索引擎优化的WordPress插件，被称之为“WordPress SEO的瑞士军刀”。 Rank Math与Yoast SEO、All in One SEO Pack下载量排WordPress SEO工具下载量前三，但其功能方面完全不输Yoast付费版，几乎可以满足用户对SEO的所有需求。更重要的是，Rank Math是一款免费插件。

<!--more-->

漏洞描述
--------

近日有研究团队发现，Rank Math插件中存在一个严重的漏洞，未经身份验证的攻击者可以利用该漏洞更新WordPress站点中的任意元数据。这将导致攻击者可以修改任意现有的文章、评论，跟或是将普通权限的用户提权为管理员，将管理员权限用户降级。

漏洞分析
--------

首先我们来看一下Rank Math插件中的漏洞触发点

漏洞触发点位于\\wp-content\\plugins\\seo-by-rank-math\\includes\\rest\\class-admin.php，见下图:

![6e9b1fd60b8e1a6d934ef7e1c6b3c05b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142425-eb043ce0-7faa-1.png)

通过上图可见，class-admin.php文件中的gutenberg_routes方法通过register_rest_route方法注册了一个自定义接口

当该自定义接口被调用后，$this->update_metadata方法将作为回调函数被调用。见下图红框处：

![4e8777ce7736d41e89dc60c51fb10859.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142437-f285ead6-7faa-1.png)

接下来看一下$this->update_metadata方法，仍然是位于\wp-content\plugins\seo-by-rank-math\includes\rest\class-admin.php中。见下图：

![2b09038ee7b7fc4bf4485395e487dc8d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142454-fc7b3cda-7faa-1.png)

首先分析$this->update_metadata方法中传入的参数。见下图红框处

![c9aa3ac8a4bea18330c48e3fd2046b5d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142521-0c590bf0-7fab-1.png)

$this->update_metadata方法从请求的参数中获取objectID、objectType与meta三个参数，分别赋值给$object_id、$object_type与$meta

接着从$meta取出键值对，并与$object_id、$object_type参数一同传递给update_metadata方法。如下图：

![40e68f1f1c8afe31db270e0d61712214.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142546-1bb2ce10-7fab-1.png)

我们具体分析一下上图中的update_metadata方法。update_metadata方法位于\wp-includes\meta.php文件中。见下图：

![d66963aea399a33288c2f1d0ee7ff316.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142611-2a28fcc6-7fab-1.png)

update_metadata方法是wordpress中用来操作元数据的操作函数，其作用是更新指定对象的元数据。

本次漏洞可以利用该update_metadata函数更新任意指定元数据。那不得不提一下wordpress元数据是什么

### 什么是元数据（Metadata）

元数据可描述为关于数据的数据。通常元数据有如下两种：

**1、结构化的元数据（Structural metadata）**是有关数据结构的设计和说明，通常叫做“关于数据容器的数据（data about the containers of data）；

**2、描述性的元数据（descriptive metadata）**，关于应用程序数据和数据内容的单个实例。

我们首先看下wordpress开发手册上关于元数据的解释：

“元数据根据其定义，是有关信息的信息。
在WordPress的情况下，它是与帖子，用户，评论和条款相关的信息。”

这里的定义不是很好理解，关于元数据，《深入理解 WordPress 元数据
(Metadata)》一文中进行了很详细的说明，下面节选其中一段关于元数据的说明片段：

![0dfe10e0b69628fca991153d2fe3affa.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142635-38a261ac-7fab-1.png)

想要更深入的了解，可以阅读下这篇文章，原文链接如下

https://www.wpzhiku.com/schedule-actions-wordpress-posts/

简单来说，元数据就是数据的辅助表，对原始表单进行扩充。

在WordPress 中有四种主要的内容类型，分别存储在四个数据表中：

Posts、User、Comment、Link

前三个都有分配给它们的元数据，存放于它们各自的元数据表中。WordPress中唯一没有元数据的对象类型（objecttype）是Link。

WordPress使用3张表存储元数据：分别是wp_postmeta、wp_commentmeta与wp_usermeta

wp_postmeta 存储关于posts的元数据（包括附件，导航菜单项和修改）。

![a9ffad5ac725753f681082738f9ca171.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142658-465ac8e8-7fab-1.png)

wp_commentmeta 存储关于评论（comments）的元数据。

![d5c3fb558b07a0ca773ac17db07a2824.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142709-4d2cb9d8-7fab-1.png)

wp_usermeta 存储关于用户的元数据。例如用户的level以及capabillities

![b8cad581847dbcc1893da3b3a6b1cc6e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142724-55c2d14a-7fab-1.png)

介绍完元数据，我们来看下upadte_metadata函数

### upadte_metadata是什么

WordPress提供如下函数对元数据进行操作

![f64927aad7286507ec477147a9f5686b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142743-60fa5dda-7fab-1.png)

我们随意跟进一个更新元数据的操作：update_user_meta()。如下图：

![1c9d6f7e16f8f2c0fd359e93c5f06e45.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142756-68d0b784-7fab-1.png)

上图可见，update_user_meta函数底层调用的是update_metadata函数进行更新操作。

除了update_user_meta之外，update_post_meta以及update_comment_meta等更新操作底层调用的都是update_metadata。由此可见，update_metadata具有直接更新任意类型元数据的功能。

利用Rank Math插件中注册的接口，未经身份验证的攻击者可以直接调用upadte_metadata，更新任意类型的元数据:例如wp_user_level以及wp_capabilities，这将导致攻击者可以将其订阅者权限的账号提权为管理员，或者将管理员的账号改为订阅者权限以限制管理员登陆。造成比较严重的危害。

漏洞利用
--------

在分析完漏洞触发点以及漏洞之后，我们来看一下如何调用这个存在漏洞的自定义接口。首先我们查看下Wordpress中注册的接口信息。见下图：

![37eec1da970f4b54b4fe1e21dde238f9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142818-75fbd088-7fab-1.png)

上图红框处，即为存在漏洞的接口

可见，接口url为*http://127.0.0.1/wordpress/wp-json/rankmath/v1/updateMeta* ,访问方式为POST请求

现在攻击者拥有一个目标WordPress账户，名为kumamon，权限为订阅者。见下图红框处：

![76eb36def22d7813a351fe782a2a9f6e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142850-89350520-7fab-1.png)

此时我们查看一下wp_usermeta表可以发现，攻击者拥有的账户在该表中的属性如下图：

![36ad6a765bd3bbe9577cd2e9b38270d5.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142905-91e74ec6-7fab-1.png)

如上图所示，第一个红框处的wp_user_level属性值为0。第二个红框处的wp_capabillities属性值为a:1:{s:10:"subscriber";b:1;}

再反观我们管理员admin账号

![03d46db68754346bc7a3ad45f693b64d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142916-98a451be-7fab-1.png)

可见wp_user_level属性值为10，而wp_capabillities属性值为a:1:{s:13:"administrator";b:1;}

因此我们可以通过调用接口，通过底层的update_metadata函数，将kumamon账号的wp_user_level与wp_capabillities属性值修改为与管理员账号相同值。

想要构造利用payload，我们仍需要分析下接口的传参情况。见下图：

![fe26f1dfdf497f1463c4d97316634d34.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142927-9f5d08fc-7fab-1.png)

上图红框处objectType参数很明显是user，meta参数是要修改的键值对，而objectID这里自然是对应的数据库表中的user_id字段了。但是攻击者账号kumamon对应的user_id是多少？如果不知道这个user_id，攻击者是无法精准的将自己控制的账号进行提权操作。

经过分析发现，在个人资料的页面中包含此信息

![764ec7d02e9fca5806fd923e9ab4f5c1.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142940-a70560ae-7fab-1.png)

该页面查看源码，即可看见当前用户userid的值，见下图红框处，值为4

![29727aa6692f4e9d49eaf81c0531f8bc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416142952-ae4dc6d0-7fab-1.png)

因此构造数据包如下：

![63f1944da613d10cb62f5e8d07a945c3.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416143005-b6090fec-7fab-1.png)

当数据包发送完毕后，kumamon账号的权限随即变为管理员

![e0ecc2c2facf4b7e293564f748a09ca9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416143018-bd8eae7a-7fab-1.png)

漏洞修复
--------

在1.0.41.2版本中，Rank Math已经对该漏洞进行修复。见下图：

![bc960eaeeb9a953a9cd8c89aa3f3d554.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416143028-c3aa52b4-7fab-1.png)

Rank Math对存在漏洞的接口调用了get_object_permissions_check方法进行权限校验，从而避免了未经授权用户的攻击行为

get_object_permissions_check方法也是1.0.41.2版本中新引进的，具体如下：

![842f8575b6cd6d64ca7ee7b0f49d2c52.png](https://xzfile.aliyuncs.com/media/upload/picture/20200416143042-cc11abdc-7fab-1.png)

底层采用了WordPress 的current_user_can方法进行权限校验