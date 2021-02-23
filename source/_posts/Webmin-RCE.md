---
title: Webmin远程命令执行漏洞(CVE-2019-15107)深入分析
date: 2019-08-24 19:20:03
tags: web漏洞分析
categories: 技术
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

近日Webmin被发现一处远程命令执行漏洞，经过分析后，初步猜测其为一次**后门**植入事件。

Webmin是目前功能最强大的基于Web的Unix系统管理工具。管理员通过浏览器访问Webmin的各种管理功能并完成相应的管理动作。据统计，互联网上大约有13w台机器使用Webmin。当用户开启Webmin密码重置功能后，攻击者可以通过发送POST请求在目标系统中执行任意命令，且无需身份验证。

<!--more-->

# **0x01 漏洞分析**
* * *

首先分析msf给出的插件

[![0](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408261534_0.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408261534_0.png)

&nbsp;

根据插件，还原出poc如下：

[![1](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408261950_1.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408261950_1.png)

当poc执行后，回像password_change.cgi发送POST请求

接下来看下password_change.cgi

&nbsp;

位于37行到188行处，存在if-else语句

他们分别是

1、if ($wuser)

[![2](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408262214_2.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408262214_2.png)

2、elsif ($gconfig{\'passwd_cmd\'})

[![3](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408262869_3.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408262869_3.png)

3、elsif ($in{\'pam\'})

[![4](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040826311_4.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040826311_4.png)

4、else

[![5](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408263475_5.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408263475_5.png)

&nbsp;

我们需要确认，程序到底进入那个if分支了

我们先print $wuser

[![6](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408263891_6.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408263891_6.png)

&nbsp;

[![7](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264127_7.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264127_7.png)

从上图打印结果看，wuser不为空，所以这里直接进入if ($wuser)分支

在if ($wuser)分支中，首先执行encrypt_password方法，如下图红框处

[![8](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264453_8.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264453_8.png)

encrypt_password方法位于\acl\acl-lib.pl

[![9](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264754_9.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408264754_9.png)

该方法的底层，调用了crypt方法，如下图，位于acl/md5-lib.pl中

[![10](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265039_10.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265039_10.png)

[![11](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265391_11.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265391_11.png)

传入该crypt方法的第一个参数为$passwd

&nbsp;

打印此时passwd

[![12](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265599_12.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408265599_12.png)

[![13](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040826581_13.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040826581_13.png)

可见值为 AkkuS|dir，也就是POST请求中的old参数值

&nbsp;

encrypt_password底层调用crypt进行编码后，将计算值return,赋值给$enc,如下图

[![14](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270184_14.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270184_14.png)

&nbsp;

由于我们传入的pass(AkkuS|dir)并不是root用户的密码，下图红框处的eq结果为false

[![15](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270362_15.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270362_15.png)

&nbsp;

因此触发pass_error，系统需要把Failed to change password : The current password is incorrect这个信息反馈给用户

[![16](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270668_16.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270668_16.png)

但是注意上图红框处，在pass_error方法的传参中，$in{’old’}被 qx/ /包裹

了解下qx/ /在perl中的用法：

[![17](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270989_17.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408270989_17.png)

qx执行外部程序，相当于``

也就是说，$in{’old’}的值会被执行。$in{’old’}就是POST中传入的old参数，可控，所以这里造成了任意代码执行漏洞。

&nbsp;

值得注意的是，POST中的old参数，是用户修改密码时所提交的旧密码。众所周知，密码是一个字符串，而非可执行代码，这里将传入的旧密码字符串拿来执行，并非正常业务逻辑所为。

&nbsp;

不仅如此，$in{‘old’}的值在被执行后，会拼接在$text{‘password_eold’}参数后面，一同传入pass_error中，如下图

[![18](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040827126_18.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040827126_18.png)

打印$text{‘password_eold’}，查看它的值

[![19](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408271552_19.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408271552_19.png)

[![20](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408271888_20.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408271888_20.png)

当我们的$in{’old’}传入”AkkuS|dir”时，dir执行后的返回值会拼接到The current password is incorrect后，传入pass_error

[![21](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272062_21.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272062_21.png)

接着，在pass_error中被打印出来

[![22](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904082723100_22.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904082723100_22.png)

这里不仅仅将用户旧密码拿来执行，更是通过pass_error，把返回值直接打印到返回值中，更加落实了被植入后门的猜测

&nbsp;

对比官网\ SourceForge\github三个不同地方下载的Webmin代码发现，官网\ SourceForge存在代码执行点，而github不存在

1、官网与SourceForge：

[![23](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272692_23.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272692_23.png)

这里存在qx包裹的$in{‘old’}

&nbsp;

再来看github上下载的同版本Webmin代码

[![24](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272931_24.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408272931_24.png)

Pass_error中竟然没有被qx包裹的$in{‘old’}

&nbsp;

对比如下：

[![25](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273256_25.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273256_25.png)

也就是说，github上下载的Webmin不存在代码执行漏洞，而官网和SourceForge上却存在

&nbsp;

&nbsp;

# **0x02 被植入后门依据**
* * *

1、 将用户提交的旧密码通过qx直接执行

[![26](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273550_26.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273550_26.png)

正常业务逻辑中旧密码为字符串，而非可执行代码，这里将密码字符串拿来直接执行，不符合逻辑

&nbsp;

2、 将执行结果通过报错打印到返回值中

[![27](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273736_27.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408273736_27.png)

如果仅仅是执行代码，攻击者无法判断后台执行是否成功，以及无法得到执行成功后的返回值，例如”dir”、”ifconfig”这类指令，是需要看回显值得。因此，在这里通过pass_error将执行成功的返回值隐蔽的返回

[![28](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274065_28.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274065_28.png)

3、 官网\ SourceForge代码中存在漏洞，github代码中无漏洞

[![29](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274482_29.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274482_29.png)

通过以上三点，初步猜测，Webmin代码被移植入后门

&nbsp;

&nbsp;

# **0x03 POC无需管道符**
* * *

目前业界流传的poc，都是需要使用管道符 “|”的形式：

例如msf给出的poc：”AkkuS|dir ”

[![30](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274792_30.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408274792_30.png)

但是经过漏洞深入的分析发现，old中的值最终会被直接执行，因此并不需要管道符

可以构造如下poc

[![31](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040827514_31.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040827514_31.png)

[![32](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408280362_32.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408280362_32.png)