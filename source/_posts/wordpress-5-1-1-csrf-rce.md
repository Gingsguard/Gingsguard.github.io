---
title: WordPress 5.1 CSRF to RCE 漏洞详解
date: 2019-03-21 15:42:58
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

WordPress是使用PHP语言开发的博客平台，用户可以在支持PHP和MySQL数据库的服务器上架设属于自己的网站。也可以把 WordPress当作一个内容管理系统（CMS）来使用。  
前些日子，RIPS放了一个WordPress5.1的CSRF漏洞通过
本文将对此次CSRF漏洞进行详细分析，RCE相关的分析见后续分析文章
<!--more-->

<h2>预备知识</h2>
在wordpress中，超级管理员是可以在评论中写入任何代码而不被过滤的

比如，在评论中输入

<img class="alignnone size-full wp-image-14805" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/add1.png" alt="" width="420" height="53" />

<img class="alignnone size-full wp-image-14760" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/1-1.png" alt="" width="741" height="374" />

直接弹框
&nbsp;

但是超级管理员在提交评论表单时，wordpress需要校验其Nonce值

想理解这个漏洞，首先要了解下wordpress的Nonce ( number used once )防御机制

Wordpress的Nonce ( number used once ) 机制，是用来防止CSRF而引进的。WordPress会为一些请求提供一个随机数进行校验，以防止未授权的请求的发生。

&nbsp;

来看下wordpress的Nonce机制是如何使用的:

1、使用wp_create_nonce生成 nonce值：

<img class="alignnone size-full wp-image-14762" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/2-1.png" alt="" width="756" height="483" />

可见，其实nonce值与$i、$action、$uid、$token有关

这里的$i 是nonce创建的时间相关变量，由wp_nonce_tick()生成，其余的$action、$uid、$token很好理解。

由这里我们可以看出，nonce的生成，与其操作也是有关系的

&nbsp;

2、将生成的 nonce传递给需要提交时验证的前端模板

3、需要验证的表单被提交后，验证其中nonce，例如下图中，本次漏洞点

<img class="alignnone size-full wp-image-14763" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/3-1.png" alt="" width="832" height="180" />

Nonce讲解完毕，言归正传，分析本次漏洞
<h2>漏洞分析</h2>
理论上，如果没法通过Nonce验证，后续的操作会直接被终止，而且在csrf攻击中，攻击者是没有办法伪造管理员实时的Nonce值。

但从本次漏洞处来看，如下图

<img class="alignnone size-full wp-image-14764" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/4-1.png" alt="" width="771" height="140" />

这里虽然没有通过Nonce的验证（wp_verify_nonce）,但是并未终止操作。Wordpress在这里使用了两个过滤方法对后续的数据进行过滤。

&nbsp;

至于为什么没有终止，而采用了如下的过滤逻辑，据说是因为WordPress其中有一些特殊的功能例如trackbacks and pingbacks会受到该值的影响，笔者没有进一步考究，感兴趣的同学可以自己分析下。

&nbsp;

到目前为止，我们虽然没有合法的nonce值，但我们的payload仍然幸存，

接下来，看看逻辑里的 kses_init_filters()这个方法

<img class="alignnone size-full wp-image-14765" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/5-1.png" alt="" width="718" height="200" />

&nbsp;
<h3>超级管理员&amp;非法Nonce情况:</h3>
我们用超级管理员身份提交一个评论，但是改包，把&amp;_wp_unfiltered_html_comment改为空，使其通过不了Nonce校验，如下图

<img class="alignnone size-full wp-image-14766" title="" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/6-1.png" alt="" width="1139" height="433" />

&nbsp;

果然进入下图断点

<img class="alignnone size-full wp-image-14767" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/7-1.png" alt="" width="805" height="144" />

&nbsp;

紧接着，进入如下断点

<img class="alignnone size-full wp-image-14768" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/8-1.png" alt="" width="754" height="223" />

使用wp_filter_post_kses对输入的数据进行过滤

&nbsp;
<h3>普通用户情况：</h3>
此时用普通用户进行评论

<img class="alignnone size-full wp-image-14769" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/9-1.png" alt="" width="728" height="539" />

<img class="alignnone size-full wp-image-14770" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/10-1.png" alt="" width="698" height="195" />

直接调用wp_filter_kses进行过滤

&nbsp;

以上思路以及明朗了

超级管理员&amp;合法nonce -&gt;不做任何过滤

超级管理员&amp;不合法nonce -&gt;wp_filter_post_kses

普通用户 –&gt;wp_filter_kses

&nbsp;

先来看看普通用户提交和超级管理员无nonce提交时调用的过滤函数有什么区别

&nbsp;

普通用户提交过滤函数：

<img class="alignnone size-full wp-image-14771" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/11-2.png" alt="" width="780" height="60" />

&nbsp;

超级管理员无nonce提交过滤函数：

<img class="alignnone size-full wp-image-14772" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/12-1.png" alt="" width="808" height="62" />

&nbsp;

可以看出只是wp_kses中第二个参数不同，一个是current_filter()，一个是’post’

这里不同的，对应wp_kses中，应该是allowed_html参数值

&nbsp;

这里举个普通用户评论的例子，普通用户提交评论，current_filter()方法返回的值是pre_comment_content，也就是说allowed_html参数值为pre_comment_content。可见下图动态调试结果

<img class="alignnone size-full wp-image-14773" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/13.png" alt="" width="903" height="345" />

对应的，超级管理员无nonce提交时，这里的allowed_html参数值为”post”

&nbsp;

那么allowed_html值不同，到底会有什么区别呢？

$allowed_html被传入wp_kses_split方法

<img class="alignnone size-full wp-image-14774" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/14-1.png" alt="" width="812" height="167" />

&nbsp;

进一步看wp_kses_split

<img class="alignnone size-full wp-image-14776" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/15-1.png" alt="" width="822" height="153" />

注意到这里$pass_allowed_html = $allowed_html;

现在$allowed_html传给了$pass_allowed_html

我们要看看这两个不同的$allowed_html最终传递到哪里被用到

&nbsp;

跟进_wp_kses_split_callback，$allowed_html传给了wp_kses_split2

<img class="alignnone size-full wp-image-14777" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/16-1.png" alt="" width="843" height="88" />

跟进wp_kses_split2，$allowed_html被传给了wp_kses_attr<img class="alignnone size-full wp-image-14778" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/17.png" alt="" width="711" height="127" />

跟进wp_kses_attr，$allowed_html被传给了wp_kses_allowed_html

<img class="alignnone size-full wp-image-14780" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/18-1.png" alt="" width="755" height="147" />

跟进wp_kses_allowed_html

一路跟踪，到了这里，$allowed_html终于有作用了

<img class="alignnone size-full wp-image-14790" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/add.png" alt="" width="653" height="141" />

回顾一下，

超级管理员无nonce提交时，这里的allowed_html参数值为”post”

普通用户提交评论时， allowed_html参数值为”pre_comment_content”。

首先看超级管理员无nonce提交吗，allowed_html参数值为”post”，进入post分支

<img class="alignnone size-full wp-image-14781" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/19-1.png" alt="" width="837" height="131" />

可以看到这里有一个wp_kses_allowed_html方法，跟进去看看<img class="alignnone size-full wp-image-14782" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/20-1.png" alt="" width="825" height="399" />

相当于一个白名单机制，再看看白名单上都有什么，看看$allowedposttags

<img class="alignnone size-full wp-image-14783" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/21-1.png" alt="" width="320" height="239" />

这里’a’标签运行’rel’属性

&nbsp;

再看看普通用户提交评论时， allowed_html参数值为”pre_comment_content”情况。

<img class="alignnone size-full wp-image-14784" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/22-1.png" alt="" width="702" height="84" />

&nbsp;

这里白名单是$allowedtags

<img class="alignnone size-full wp-image-14785" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/23.png" alt="" width="356" height="178" />

只允许’href’与’title’

看到这里，明白wp_filter_post_kses 、wp_filter_ kses两个过滤函数有什么区别了吗？

&nbsp;

可以用’rel’属性与不可以用’rel’,有什么区别呢？如何造成这次的csrf呢？看下图

wp-includes\formatting.php

<img class="alignnone size-full wp-image-14786" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/24.png" alt="" width="853" height="534" />

可以看到属性值在没有被转义处理的情况下就再次拼接在一起，

在a标签最终被拼接时，title的属性会被封装到双引号中，这样我们就可以构造数据使其闭合，从而执行js

Payload：

<img class="alignnone size-full wp-image-14806" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/add2.png" alt="" width="482" height="51" />

被双引号包裹后

<img class="alignnone size-full wp-image-14810" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/add3-1.png" alt="" width="459" height="36" />

单鼠标放置时，js执行

&nbsp;

但是这个wp_rel_nofollow_callback哪里来的呢？

&nbsp;

看一下wordpress对comment_content都采用了哪些默认的过滤器

&nbsp;

\wp-includes\default-filters.php

<img class="alignnone size-full wp-image-14787" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/25.png" alt="" width="801" height="42" /> <img class="alignnone size-full wp-image-14788" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/26.png" alt="" width="782" height="109" /> 上图三个分别是：

wp_rel_nofollow

convert_invalid_entities

balanceTags

&nbsp;

看下wp_rel_nofollow

<img class="alignnone size-full wp-image-14789" src="http://blog.nsfocus.net/wp-content/uploads/2019/03/27.png" alt="" width="655" height="139" />

wp_rel_nofollow_callback是在这里被加载并使用的

&nbsp;
<h2>结语</h2>
最后，整理下流程

此次漏洞的流程是：

(超级管理员&amp;不合法nonce) -&gt;(wp_filter_post_kses)-&gt;(’rel’属性在白名单中逃逸)-&gt;(wordpress加载默认评论内容过滤器wp_rel_nofollow)-&gt;(加载wp_rel_nofollow_callback) -&gt;(未过滤并用双引号包裹title值)-&gt;(js执行)-&gt;(RCE)