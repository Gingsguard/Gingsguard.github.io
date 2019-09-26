---
title: Drupal Core SA-CORE-2018-006 mail() 函数代码注入漏洞分析
date: 2018-10-29 15:41:11
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2018/03/drupal.png)

近日，Drupal官方发布安全通告修复了多个安全性问题，其中包括2个严重的远程代码执行漏洞，影响Drupal 7和8的多个版本。其中一个漏洞源于在发送emai时，一些变量没有进行适当的处理就传给了shell执行，因此可能导致远程代码执行。

<!--more-->

漏洞预警可以参考这里
> [http://blog.nsfocus.net/drupal/](http://blog.nsfocus.net/drupal/)
> &nbsp;

## 漏洞Mail方法

本次漏洞出现在PhpMail.php中

下面看下存在漏洞的mail方法

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/7b3ec22d68ca3f737740cfbde1e6e74d.png)

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/e6c094a322e293af6b7286802a09d627.png)

&nbsp;

接下来可以看下drupal在8.6.2版本中修补的代码，如下两张图

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/de76deb7a29b39a4ab95e25ec4a38217.png)

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/a1b281f3aed8cf59026a14442a04b465.png)

&nbsp;

通过这个补丁可以看出，8.6.2版的drupal对$message['Return-Path']值进行了验证，通过后拼接”-f”赋值与$additional_headers。

## PHP中的mail方法

下面看下php中的mail方法：

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/01afad47e39f44b21cfccb74fc0fd63a.png)

Mail方法接收五个参数，这里我们重点关注第五个参数 $additional_parameters

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/5dc80b4f40894e4d8d691929e69a8114.png)

从参数说明可以看出，这个$additional_parameters参数通常是用于将其他参数传递来设置发送邮件时的一些属性，比如使用的-f参数，用来配置封发件人地址

&nbsp;

比如说如下例子

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/c6d1790a12a88536d3b6c17c296a28fd.png)

Drupal中的作用也是如此的，如下图8.6.1版本的存在漏洞的drupal代码：

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/8e47c743abe46e0c2dee73dfa002e2b2.png)

判断是否存在$message[‘Return-Path’],如果有，就拼接”-f”作为mail的$additional_parameters参数进行使用。

&nbsp;

**mail**函数第五个参数漏洞。看到这里，有没有想起来之前16年的PHPMailer漏洞？当时我也曾对这个漏洞进行过分析，链接如下：

http://blog.nsfocus.net/phpmailer-vulnerability-analysis/

&nbsp;

漏洞原理极其相似，甚至在利用上都是一样的

## 漏洞利用方法

简单的介绍下一种利用方法：

在传递$additional_parameters参数时，由于没有进行有效的过滤，我们可以在后面构造出 -X参数，这个参数的作用是指定写入log的文件路径，然后就可以将可执行的代码通过邮件正文写入我们制定位置的日志文件中去。Payload类似这样的
<pre class="lang:default decode:true">xxx( -X/var/www/test.php )@qq.com</pre>
&nbsp;

最终的$additional_parameters参数类似这样的：
<pre class="lang:default decode:true">-fxxx( -X/var/www/success.php )@qq.com</pre>
&nbsp;

然而呢？

PHPMailer 小于 5.2.18 版本的 RCE 漏洞，官方在补丁中使用了escapeshellarg来防止注入参数，但是当时这个补丁是可以被**绕过**的。

看下当时PHPMailer怎么补的

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/d18fe8585c9dc5b41e7706f6be101bde.png)

PHPMailer的补丁中，对传入的参数使用escapeshellarg进行过滤，但是php中mail方法自身用使用了escapeshellcmd进行处理，最终用这两个方法配合，反而弄巧成拙，造成绕过，具体的可以参考当时的那个漏洞，很有意思，这里不细说了,具体的可以看下那个漏洞。

&nbsp;

温故下escapeshellarg和escapeshellcmd用法：

&nbsp;

### escapeshellcmd：

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/7fadb4b66067265bd5be80a393fd6069.png)

### escapeshellarg：

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/01dc7a5e7ed3c9bc4f7a8c0486fe8cda.png)

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/dab5c99f9daed0ec46790c6a479f7349.png)

但是这次的drupal是怎么做的呢？是否也可以绕过呢？

![](http://blog.nsfocus.net/wp-content/uploads/2018/10/07cdf77d32073ede6c4a825705ce3fc0.png)

首先看第一个if分支

可以看出，只要escapeshellcmd处理后和原string不一样，或者escapeshellarg处理后不是'$string', "$string"这两个样子的，直接return **false****，**之前的PHPMail是过滤后拿来用，而这里是发现string中有_&amp;#;`|*?~&lt;&gt;^()[]{}$\_, _\x0A_ 和 _\xFF__，或是里面string有单引号双引号，直接return false，一点构造payload的机会都不给。_

_ _

再看第二个if

可以看出这是一个正则表达式，除了email中可以使用的a-zA-Z0-9@_\-.这些字符，其他的出现则return false，实在是难以利用。

## 总结

*   漏洞原理比较的简单，和之前的那些mail第五个参数注入漏洞完全一样。
*   补丁比较有效，和之前那些出过问题的应用处理手法完全不一样。