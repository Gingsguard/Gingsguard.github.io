---
title: MyBB <= 1.8.20：从存储型XSS到RCE漏洞深度分析
date: 2019-09-24 19:26:54
tags: web漏洞分析
categories: 技术
---

<div align="center">{% asset_img 1.jpg%}</div>

MyBB是国际上非常优秀的免费论坛软件，最大的特色是简单但是功能却出奇的强大，支持多国语言，可以分别设置前台后台的语言。

MyBB作为一个开源项目，拥有活跃的社区环境，项目的管理,发展由社区志愿者支持。用户量广泛，在github上的项目拥有609 个star，79个releases。

MyBB &lt;= 1.8.20存在一处从存储的XSS到RCE组合利用漏洞，攻击者可以先通过xss获得管理员权限，再通过rce达到远程代码执行。这套利用流程不仅隐蔽而且利用难度低，只要私信给mybb管理员发出一条包含payload的消息即可。

<!--more-->

该漏洞由RIPS 团队安全研究人员Simon Scannell发现并纰漏。但截止目前，并未公布利用poc

我们试图从Simon Scannell简单的漏洞披露中深入分析该漏洞，并尝试还原出poc

首先分析下mybb xss漏洞

&nbsp;

# **0x01 XSS漏洞**
* * *

此漏洞为mybb对BBCode的错误解析而造成的

首先了解下BBCode:

BCode是Bulletin Board Code的缩写，属于轻量标记语言（Lightweight Markup Language）的一种，如字面上所表示的，它主要是使用在BBS、论坛、Blog等网络应用上。BBcode的语法通常为 [标记] 这种形式，即语法左右用两个中括号包围，以作为与正常文字间的区别。系统解译时遇上中括号便知道该处是BBcode，会在解译结果输出到用户端时转换成最为通用的HTML语法。

下图举个简单的例子：

[![0](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408424824_0.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408424824_0.png)

在BBcode中给关键词加链接可以用下面的代码：

[url=[https://www.xiongbenxiongbenxiong.com/1.html](https://www.xiongbenxiongbenxiong.com/1.html)]熊本熊本熊[/url]

然而，BBcode只是一种标记语言，并没有一个共同的标准。各个BBS、论坛、Blog等网络应用程序可能会有自己独创的BBcode。在实际场景中，不同的程序会在后台使用不同的方式将BBcode解析成html来进行页面渲染

接下来看下mybb程序对BBCode的解析流程

举一个例子，使用BBcode格式分别插入的一条视频链接与一条url链接

[![1](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425165_1.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425165_1.png)

Mybb程序会对BBcode进行解析，以便转化为浏览器可识别的html语言

Mybb首先会对video链接进行解析（注意：这与video和url的排列顺序无关，在程序的后台，会首先处理video，后处理url）

经过video解析器解析后的格式如下

[![2](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425474_2.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425474_2.png)

接着mybb对BBCode格式的url进行解析，经过url解析器解析后的格式如下

[![3](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425622_3.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408425622_3.png)

此时，mybb以将BBcode语言解析成为html语言，浏览器渲染页面，显示嵌入的video与超链接中的url

如果，我们将两个BBCode格式的语句进行嵌套呢？

像如下图这样的形式

[![4](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040842598_4.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040842598_4.png)

按照我们的推测，会进行如下的解析：

首先，解析video

[![5](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904084302100_5.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904084302100_5.png)

解析之后的格式如上图

然后，解析url，也就是下图红框处的结构

[![6](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408430523_6.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408430523_6.png)

解析之后的结果如下图

[![7](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408430716_7.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408430716_7.png)

[![8](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431056_8.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431056_8.png)

注意上图红框这里，src中的值，被href引入的双引号闭合，而onmusemove成功逃逸出来，意味着alert会在鼠标移动时，alert将会被执行

事实上，以上的流程，在mybb中是否成立。正式因为上文猜测中的嵌套解析，造成了此次xss漏洞

接下来跟下代码

首先，我们给管理员（admin）账号发一条如下图bbcode语言的私信

[![9](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431490_9.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431490_9.png)

这条私信会原封不动的被写入数据库中

[![10](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431789_10.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408431789_10.png)

当管理员查看私信时，这条message会被从数据库中取出，并解析为html语言进行渲染

[![11](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408432090_11.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408432090_11.png)

程序调用private.php执行上述操作，跟进private.php

[![12](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040843246_12.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040843246_12.png)

在997行处，程序将留言从数据库中取出，并赋值$pm

[![13](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408432858_13.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408432858_13.png)

在11789行处，将$pm传入build_postbit方法

[![14](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408433134_14.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408433134_14.png)

跟入build_postbit方法

[![15](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408433443_15.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408433443_15.png)

在该方法774行处，将message传入parse_message,这里的message即为我们构造的BBCode语句

跟入parse_message方法

[![16](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434148_16.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434148_16.png)

在parse_message方法中201行处，调用parse_mycode对$message进行处理

跟入parse_mycod方法

[![17](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434479_17.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434479_17.png)

如上图，第一个红框处，会对bbcode中的video结构进行解析，而第二个红框处，会对url,email等结构进行解析。正因为这里的解析的先后顺序，决定了构造poc时的嵌套顺序

首先来看video解析

[![18](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434815_18.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408434815_18.png)

这里使用了preg_replace_callback，对匹配到的内容使用mycode_parse_video_callback回调进行替换

[![19](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435155_19.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435155_19.png)

跟入mycode_parse_video_callback

[![20](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435498_20.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435498_20.png)

可见mycode_parse_video_callback将$matches[1], $matches[2]传入mycode_parse_video方法

跟入mycode_parse_video方法

 [![21](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435737_21.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408435737_21.png)

如下图，首先使用parse_url对传入的url($matches[2])进行解析

 [![22](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440199_22.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440199_22.png)

解析后的parsed_url值如下图

 [![23](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440475_23.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440475_23.png)

接着，将$parsed_url['fragment']赋值与$ fragment

 [![24](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440715_24.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408440715_24.png)

随后，进入switch语句，根据不同视频来源，分情况解析。我们这里构造的是youtbe来源，进入该分支

 [![25](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441164_25.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441164_25.png)

在下图中，将$ fragment中的!v=置空，赋值与$id

[![26](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441466_26.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441466_26.png)

此时id值为test[url=onmousemove='alert(1337)']

 [![27](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441887_27.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408441887_27.png)

随后，由于担心xss攻击，程序在这里对$id进行html特殊字符转义处理，如下图

[![28](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442138_28.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442138_28.png)

[![29](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442429_29.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442429_29.png)

接着，从templates中取出对应video的模板，如下图$templates get方法

[![30](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442779_30.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408442779_30.png)

根据get方法，看下取出模板的形式

[![31](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904084430100_31.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/20190904084430100_31.png)

上图为最终生成html的模板，此处的$id即为上文中case分支中赋值的$id

最终，将$id值填充的模板中，结果如下图

[![32](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443348_32.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443348_32.png)

回到preg_replace_callback处，$message替换后的结果如下图

[![33](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443628_33.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443628_33.png)

此时$message=&lt;iframe width="560" height="315" src="//www.youtube.com/embed/test[url=onmousemove='alert(1337)']" frameborder="0" allowfullscreen&gt;&lt;/iframe&gt;[/url]

Video的解析到此结束了，此时html语句，是不是和上文流程中猜测的形式一样呢？

&nbsp;

接下来，仍然使用preg_replace_callback对url进行替换

[![34](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443948_34.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408443948_34.png)

如下图可见，使用#\[url=((?!javascript)[a-z]+?://)([^

"&lt;]+?)\](.+?)\[/url\]#si正则进行匹配，使用

mycode_parse_url_callback1回调对$message进行替换

[![35](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444218_35.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444218_35.png)

此处的处理与上文中的video极其相似，这里就不重复说明了

在url解析结束后，messgae值如下图

[![36](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444522_36.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444522_36.png)

可见，如上文流程分析一致，href中引入的双引号，将src闭合了，onmousemove得以逃逸

最终，xss产生

[![37](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444935_37.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408444935_37.png)

[![38](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445217_38.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445217_38.png)

[![39](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445522_39.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445522_39.png)

利用给管理员私信的这个功能，通过xss漏洞，可以获取管理员cookie，从而获得后台权限

接下来分析下rce漏洞

&nbsp;

# **0x02 RCE漏洞**
* * *

Mybb后台提供导入theme功能

[![40](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445899_40.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408445899_40.png)

可以选择本地theme进行导入，上传的theme格式许为xml格式，形式如下

[![41](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450222_41.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450222_41.png)

这里的导入的xml文件存储了该theme下所有包含的css文件，下面展示其中两个片段

[![42](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450698_42.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450698_42.png)

[![43](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450976_43.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408450976_43.png)

简单来说，相当于是把这个theme里包含的所有css都存储到xml一个结构里

在上传xml格式的theme时，程序后台会解析该xml，如下图代码

[![44](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451292_44.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451292_44.png)

随后，将解析的xml树中的内容，例如css名称，内容、id等写入数据库

[![45](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451570_45.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451570_45.png)

上图即为解析上传的xml格式的theme，将解析出的css的信息入库的操作

[![46](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451874_46.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408451874_46.png)

入库后，数据库中内容如上图

在解析xml内的css数据的name时，后台程序会校验css的后缀是否合法

[![47](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452251_47.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452251_47.png)

可见，程序要求xml结构中，css文件后缀应为.css。但其校验方式仅仅检测css名称后四位是否为.css

当我们构造css数据时，可以使得css文件名为aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css,在css文件内容处插入payload，如下图

[![48](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452587_48.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452587_48.png)

在xml解析后，$stylesheet['attributes']['name']的值为aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css，成功绕过检测

当进行入库操作时，如下图代码

[![49](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452876_49.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408452876_49.png)

此时将要插入表中name字段的值为aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css，由于mysql默认字段长度为30字符，而我们的name长度为34字符，所以，.css会被截断，最终插入表中name字段的值为aaaaaaaaaaaaaaaaaaaaaaaaaa.php。

与此同时，aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css中的内容，会插入到stylesheet字段中，我们构造的payload随同aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css中的内容，一同写入数据库。

[![50](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453146_50.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453146_50.png)

程序在执行xml数据从解析到入库的操作的同时，也会在本地生成对应的文件，如下图

[![51](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453593_51.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453593_51.png)

这里生成文件名仍是.css后缀。原因很好理解：这里生成的文件名由解析上传的xml文件中的css name值决定的，如下图

[![52](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453755_52.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408453755_52.png)

因此后缀为.css

&nbsp;

接下来在后台页面中，查看我们刚刚导入的theme

[![53](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454088_53.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454088_53.png)

可以看到我们grq themes里的css列表中，后缀已经变为php

这是为什么呢？原因很简单，因为此处展示的内容，是从数据库中查询得到，此时数据库内容如下图

[![54](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454318_54.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454318_54.png)

数据库由于30字符最大长度的截断，已经把入库的文件名后的.css截断了，此时数据库中name的后缀变为php

这时，点击Stylesheets in grq 列表中的aaaaaaaaaaaaaaaaaaaaaaaaaa.php，进入编辑页面

[![55](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454721_55.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408454721_55.png)

[![56](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455075_56.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455075_56.png)

再次查看后台文件夹，可见生成了一个.php后缀文件，如下图

[![57](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040845533_57.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040845533_57.png)

这里的原理也很简单。点击编辑css文件时，程序会从数据库中读取该文件的name以及内容，

并判断在指定目录中是否存在，若不存在，则用数据库中取出的name为文件名，生成文件，并将数据库中取出的内容写入该文件中

由于此时库中的name为aaaaaaaaaaaaaaaaaaaaaaaaaa.php，所以在指定位置生成了aaaaaaaaaaaaaaaaaaaaaaaaaa.php文件

下面跟下php文件生成的流程与代码

在点击aaaaaaaaaaaaaaaaaaaaaaaaaa.php，进入其编辑页面这个操作

[![58](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455691_58.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455691_58.png)

&nbsp;

此时发送请求如下

[![59](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455935_59.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408455935_59.png)

后台代码执行如下：

首先进入

\admin\modules\style\themes.php

[![60](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408460279_60.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408460279_60.png)

此时的action为edit_stylesheet，进入上图分支

接着从数据库中查询该条数据，执行的sql语句如下

[![61](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408460538_61.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408460538_61.png)

[![62](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040846089_62.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/201909040846089_62.png)

查询结果如上图

&nbsp;

最后将库中内容写入文件，文件名即为库中name字段，文件内容即为库中stylesheet字段

[![63](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461176_63.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461176_63.png)

如上图，构造的payload被写入aaaaaaaaaaaaaaaaaaaaaaaaaa.php

&nbsp;

打开aaaaaaaaaaaaaaaaaaaaaaaaaa.php，可见payload成功写入

[![64](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461455_64.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461455_64.png)

&nbsp;

访问该文件

[![65](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461889_65.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408461889_65.png)

Phpinfo执行成功

&nbsp;

&nbsp;

&nbsp;

# **0x03 漏洞分析时发现的问题**
* * *

### **1. sql_mode默认值问题**

笔者在尝试构造与复现rce漏洞时，当构造34字符长度文件名，以便通过mysql最大长度截断机制截断时，出现的如下问题：

[![66](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462238_66.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462238_66.png)

Data too long~

笔者使用的是Wamp环境，在查看安装的mysql配置时，发现默认sql_mode为STRICT_ALL_TABLES，如下图：

[![67](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462511_67.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462511_67.png)

STRICT_ALL_TABLES：

对所有引擎的表都启用严格模式。(STRICT_TRANS_TABLES只对支持事务的表启用严格模式)。

在严格模式下，一旦任何操作的数据产生问题，都会终止当前的操作。对于启用STRICT_ALL_TABLES选项的非事务引擎来说，这时数据可能停留在一个未知的状态。这可能不是所有非事务引擎愿意看到的一种情况，因此需要非常小心这个选项可能带来的潜在影响。

在严格模式下，超长的字符串，不能被截断入库，因此这里可能会影响到该漏洞的利用

### 

### 2.urldecode的必要性

在xss漏洞中，漏洞作者原文有一段描述如下

 [![68](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462865_68.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408462865_68.png)

漏洞作者在他的文章中这样描述

“通常，由于正则表达式过滤器可以防止此类攻击，因此无法在其他bbcodes中注入bbcodes。但是，对于呈现[video] bbcodes的回调方法会在应嵌入的视频的URL上调用urldecode（）。视频URL被urldecoded，这将允许绕过正则表达式保护并通过URL编码注入。”

从作者的描述来看，正是因为此处的urldecode存在，导致被url编码后的payload可以绕过正则防护，从而造成注入。根据作者描述，构建的流程如下：

1.Payload-&gt;正则过滤器-&gt;检测不通过-&gt;失败

2.url编码后的payload-&gt;正则过滤器-&gt;检测通过-&gt;urldecode-&gt;还原为明文payload-&gt;注入成功

但是在我实际分析中，发现根本不需要对payload进行URL编码，正如上文我构造的pyaload，无需编码仍可触发漏洞。而且，也没有在urldecode执行前，发现正则过滤器

### 3.RCE漏洞的入口

关于RCE漏洞的入口，作者原文描述如下:

 [![69](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463197_69.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463197_69.png)

在此处，作者多次提到create与choose the filename字眼，一度让我认为漏洞存在于创建与修改Theme处，如下图

 [![70](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463671_70.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463671_70.png)

或是修改Template Name处，如下图

 [![71](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463921_71.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408463921_71.png)

在尝试寻找rce入口时，发现一处有意思的地方，当修改templates为aaaaaaaaaaaaaaaaaaaaaaaaaa.php.css时

 [![72](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464218_72.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464218_72.png)

保存后，程序会将.css截断，并提示后缀问题，如下图

 [![73](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464587_73.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464587_73.png)

在跟踪此处代码时发现，在修改template name时，程序是会检查文件名长度并截断的，控制template name长度为30字符，如下图

 [![74](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464861_74.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408464861_74.png)

这里可以印证，漏洞入口并不在修改名字和创建template处，经过后来的分析与寻找，才找到上文中真正的入口点，也就是Import a Theme处。但是从这个过程可见，mybb对文件名长度还是有一定限制的，只是防护的有疏漏，忘记检查导入的xml结构中的name字段长度。

&nbsp;

# **0x04 漏洞修复**
* * *

### **xss漏洞**

针对xss漏洞，使用encode_url方法替换原来的htmlspecialchars_uni，如下图

 [![75](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465133_75.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465133_75.png)

回顾上文，在漏洞利用中，id中的内容为嵌套的url bbcod代码

 [![76](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465356_76.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465356_76.png)

当id被url编码后，之后在通过正则解析url bbcod代码时，该处被编码后的内容就不会被正则匹配到，从而防止嵌套解析造成xss漏洞

### RCE漏洞

针对rce漏洞，使用my_substr方法限制name长度为30字符，如下图

 [![77](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465669_77.png)](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/09/2019090408465669_77.png)