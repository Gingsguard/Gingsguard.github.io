---
title: Discuz-ML!-V3.X 远程代码执行漏洞分析
date: 2019-05-16 19:01:08
tags: web漏洞分析
categories: 技术
cover: http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/6a11aaf8e72231dbfe893194de0c45a0.png
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

Discuz！ML是一个由CodersClub.org创建的多语言，集成，功能齐全的开源网络平台，用于构建像“社交网络”这样的互联网社区。该引擎基于Comsenz Inc.创建的着名的Discuz！X引擎开发。

&nbsp;2019年7月11日， Discuz！ML被发现存在一处远程代码执行漏洞，攻击者通过在请求流量的cookie字段中的language参数处插入构造的payload，进行远程代码执行利用，该漏洞利用方式简单，危害性较大。

<!--more-->

# **0x01 漏洞描述**

* * *

2019年7月11日， Discuz！ML被发现存在一处远程代码执行漏洞，攻击者通过在请求流量的cookie字段中的language参数处插入构造的payload，进行远程代码执行利用，该漏洞利用方式简单，危害性较大。

本次漏洞是由于Discuz! ML对于cookie字段的不恰当处理造成的

cookie字段中的language参数未经过滤，直接被拼接写入缓存文件之中，而缓存文件随后又被加载，从而造成代码执行

简而言之，如下图流程可以简单的理解该漏洞

首先，通过cookie传入payload，构造好的payload被写入template文件中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/7995123cf0180b71dfc3d5a14f812f0d.png)

接着，这个被插入payload的template.php文件被include，造成代码执行

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/560fe841e93e9950aa9d23d2293d09c8.png)

&nbsp;

# **0x02 受影响的系统版本**

* * *

Discuz! ML v.3.4

Discuz! ML v.3.3

Discuz! ML v.3.2

&nbsp;

# **0x03 漏洞分析**

* * *

本次漏洞是由于Discuz! ML于对于cookie字段的不恰当处理造成的

程序对cookie中的language字段的操作过程，位于\source\class\discuz\discuz_application.php中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/5a301814f5679822fd941f96e3aff9bb.png)

在这里，从cookie中取出language值，未经过滤，直接赋值给$lng变量

接着将$lng值赋值给名为DISCUZ_LANG的常量

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/9cd8f9c903e9c0898cfaa4970d014328.png)

在Discuz! ML中，在生成cachefile名时，需要使用到DISCUZ_LANG这个常量进行拼接

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/200495f42362d36df811a8aae17e54e5.png)

由于DISCUZ_LANG常量由cookie中传递而来，并未经过任何过滤，因此DISCUZ_LANG常量可控

&nbsp;

在程序运行时，Discuz! ML会将template/default/common目录下的默认模板写入缓存

在这个过程中，程序首先会打开并读取位于template/default/common目录下默认模板中的内容：

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/4728787a3cba82433fc3d3fd9b3ab124.png)

这里将读取的header.htm模板中的内容赋值给$template变量

&nbsp;

再读取默认模板内容之后，程序接下来通过preg_replace_callback方法对模板内容进行替换与修改

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/8cc38ce61df32dc7b7d51c6e856e1372.png)

在对默认模板内容进行修改时，注意如下图片中操作

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/423679b9a066fecd6550006cf68a4217.png)

上图操作中，会将'$tplfile', '$fname', ".time().", '$templateid', '$cachefile', '$tpldir', '$file'这些变量值拼接到名为headeradd的变量中

&nbsp;

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/e3ddd6682f0ece27b9424bdc9434fb96.png)

Headeradd变量随后被拼接到$template中

&nbsp;

注意这里的headeradd变量

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/27c609d1f8e1849863fba2ee289f7835.png)

如上图红圈处，这里将cachefile变量拼接到headeradd变量中，间接的将cachfile变量拼接到template中。

还记得cachefile变量吗？

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/200495f42362d36df811a8aae17e54e5.png)

Cachefile变量的值，其中一部分是可控的

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/39c1861505bb7b2cc9d80cfb98dde40e.png)

例如上图，我们可以在其中插入形如 sc.’phpinfo().’的payload

这个payload随着headeradd变量，被带入template中

接下来，被污染的template值被写入缓存文件中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/fc5d5be10b4c6577c6f7c3caee88f0f9.png)

如上图可见，最终写入的缓存文件名即为cachefile的值，内容即为template值，Payload已经随着headeradd拼接到template而被写入这个缓存文件中

上图这里看起来比较杂乱，简化起来如下图

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/5f872ac8ce662e4f8fe7141128f4f97f.png)

当缓存文件被注入如上文payload后，再次加载程序，

当程序执行到位于\source\module\forum\forum_index.php处时：

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/8d202ec852784f1506f1f667d23c5acb.png)

可见上图432行，会使用include方法包含 template方法的返回值

&nbsp;

跟进Template方法，找到其返回值，即是此处被include中的内容

Template方法位于\source\function\function_core.php

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/07/f6901cb506f6d06be066992005264466.png)

在其654行处，可见返回cachefile路径，cachefile即为上文被植入payload的文件路径

由此，被插入payload的缓存文件被include，其中构造好的payload被执行，造成代码执行漏洞

&nbsp;

# **0x04**  **修复建议**

* * *

目前官方没有进行修复，请时刻关注：https://bitbucket.org/vot/discuz.ml/commits/all，等待官方补丁。