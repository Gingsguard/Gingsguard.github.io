---
title: GetSimpleCMS-Unauthenticated 远程代码执行漏洞分析
date: 2019-09-24 19:16:31
tags: web漏洞分析
categories: 技术
---

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/e7d8da61ad89925b95bb3ee9e45f6631.png)

GetSimple是一款基于XML的开源的内容管理系统。Getsimple cms的使用量较为广泛，从官方给出的统计数据来看，GetSimple拥有超过12万次的下载量

在GetSimple 3.3.15版本中，攻击者可以通过伪造管理员cookie，绕过身份验证登陆后台，进而通过后台编辑模板功能模块写入php代码，造成远程代码执行漏洞

<!--more-->

# **0x01 漏洞描述**

* * *

在GetSimple 3.3.15版本中，攻击者可以通过伪造管理员cookie，绕过身份验证登陆后台，进而通过后台编辑模板功能模块写入php代码，造成远程代码执行漏洞。

Metasploit针对此次漏洞，也推出相应的利用插件

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/840316b19ec09e23988648334c42d0fd.png)

详情可见packet storm链接：

https://packetstormsecurity.com/files/152961/GetSimpleCMS-3.3.15-Remote-Code-Execution.html

&nbsp;

&nbsp;

# **0x02 受影响的系统版本**

* * *

GetSimple&lt;=3.3.15

&nbsp;

&nbsp;

# **0x03 漏洞编号**

* * *

CVE-2019-11231

&nbsp;

&nbsp;

# **0x04 漏洞分析**

* * *

在分析该漏洞前，不得不提.htaccess文件，本次漏洞的产生，是因为默认情况下apache对.htaccess配置文件的开启情况不同而产生的。

htaccess文件是Apache服务器中的配置文件，它负责相关目录下的网页配置。通过配置htaccess文件，可以实现众多功能，例如：允许/阻止特定的用户或者目录的访问、禁止目录列表、配置默认文档等。

启用.htaccess，需要在apache配置文件中，启用AllowOverride。

在笔者测试了两款环境，分别为配置了wamp的windows与ubuntu服务器，在这两个环境中，默认情况对htaccess文件的启用情况是不同的。

先来看安装有wamp的windows环境，打开apahce配置文件httpd.conf

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/33fb548acfc58b7ac5717900e039b927.png)

可以看到，这里将位于conf/extra/httpd-vhosts.conf文件导入

跟进 httpd-vhosts.conf文件

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/d5dc1155047ddd9cfd276ee555973bbf.png)

可以看到，在这里，默认情况下 AllowOverride 默认值是All

当AllowOverride指令设置为 All时，所有具有".htaccess"作用域的指令都允许出现在.htaccess文件中。

此时，目录中的.htaccess配置文件为启用状态

例如位于getsimplecms/data目录中的.htaccess配置文件

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/8710c3b580348616abb6b1c5f29926be.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/4ff4202d805ac20f20a4ab3f3c4cee13.png)

&nbsp;

当此.htaccess配置文件被加载时，是禁止该目录被web端访问的

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/425cc108ea9cafb4e56ff37e536667b9.png)

也就是说，通过该方法，通过web端访问data目录时，不会显示其中文件列表

与其中文件内容，是可以很好的保护存在于该目录下的文件，不被泄露

但是在笔者的ubuntu服务器，ubuntu apache2.conf中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/92371b4bbd1d1215aed845ef903abf85.png)

AllowOverride 默认值是None，默认的情况下，不加载目录中的.htaccess

我们将上述的.htaccess文件放入ubuntu服务器的web目录中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/1caa4a8eedb5684f9319d60b63a6aad9.png)

再通过浏览器访问这个路径

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/9474c387505faf554297a061b63d9922.png)

如上图可见，.htaccess并没有生效，而路径中的文件，是可以被泄露的

回归到本次漏洞：

访问http://127.0.0.1/getsimplecms/data/users/admin.xml

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/f51ce9b10a60cc6bfef5dcbe4b4429a2.png)

在.htaccess没有生效的情况下，我们获取admin.xml中记录的用户相关信息，该cms并没有将用户信息写入数据库，而是全部存于该文件中

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/d7e8b50b48d916e31bdc0f34eb294c00.png)

访问http://127.0.0.1/getsimplecms/data/other/authorization.xml获取authorization.xml中记录的apikey

现在我们得到如下的信息：（用户名/加密后的密码/apikey）

该cms并没有将用户信息写入数据库，而是全部存于xml文件中

通过获取的信息，接下来进一步分析如何利用这些泄露的信息：

&nbsp;

**Cookie****算法分析：**

分析下GetSimple中的cookie是如何生成的

位于\GetSimpleCMS\admin\inc\cookie_functions.php

create_cookie方法

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/71cf338a24e2f5d299a6a0bf17eee8d7.png)

计算cookie所需的$USR $SALT 对应如下：

GetSimpleCMS\data\users\admin.xml文件

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/5ebdf7efe2978f33be5c8646453aec5d.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/0bc28463ea9803bf8d66b973af0d8924.png)

&nbsp;

getsimplecms\data\other\authorization.xml

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/eaaa1f73a863f9c35b522abc831022ce.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/2b25c623398bdd646967fb4a5900bc18.png)

这些信息是可以直接读取出来的

getsimplecms 中Cookie的算法的实现如下:

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/9c47e0ca312ccbf96e9ba83e85e62e69.png)

&nbsp;

算法相对简单，通过$SALT值与$USR进行拼接；$SALT值与$cookie_name拼接，最终通过sha1进行加密，算出对应的cookie键值对

通过泄露的文件与cookie算法，可以顺利计算出对应用户的cookie

现在，可以伪造任意成员的cookie了

以USR :admin举例说明：

最终拼接的cookie为：

GS_ADMIN_USERNAME=admin;48fd5258d478eec2a8f417f358c767c992f01b51=8ce411833fcfaedf4fcf5390132a153c00e0482c

&nbsp;

**Password****算法分析：**

分析下Password的计算方式

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/b911761b7f4485b3b7cc4725e94eab5d.png)

Password的加密，是通过passhash()方法来实现的

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/13b52623a2c40de2dee14718f491e452.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/bd93cf9866b092b8d92ebd6a96c0f300.png)

GSLOGINSALT是用来保护的密码的额外的salt值，默认情况为空。

所以这里的密码计算就比较直接了，通过sha1方法对明文密码进行加密

    sha1($p)

通过sha1 hash将明文密码加密为密文。

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/8db21433099383b6a47fbb7387b4670d.png)

也就是说，只要获取了加密后的password，有一定几率，可以破解为明文：

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/a8fb07b8a4942c681657da675eec1963.png)

获取到管理员cookie/password后，使用管理员账号登陆后台

&nbsp;

通过伪造cookie访问后台：

未登录时，访问后台地址

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/47bc6febbcfdde8d02b9821606b39f2a.png)

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/403179b2029b01b0dbb89958b7f8e268.png)

此时需要填写正确的用户名密码才可以登陆后台

这里，通过改包的方式，将cookie修改为之前计算出的值

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/2cfff8d9aae7746778eb8d537c5d4523.png)

此时，无需登陆，直接进入后台

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/88958e1d119a606e6815cc2d36a53873.png)

访问如下url

http://127.0.0.1/getsimplecms/admin/theme-edit.php

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/7d35092eae92dd89eb370ba1accef8ca.png)

在这里可以对模板文件进行编辑，在这里可以写入任意php代码，造成远程代码执行漏洞

例如：

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/71f77773b77a70dc7d03abe48fa61e34.png)

访问如下地址：

http://127.0.0.1/getsimplecms/theme/Innovation/template.php

![](http://alphalab1-wordpress.stor.sinaapp.com/uploads/2019/06/81e5e768a8b9eff4fa68326fa2e8dcb3.png)

&nbsp;

插入的php代码被成功执行

# 

&nbsp;

# **0x05**  **修复建议**

* * *

目前官方没有进行修复，使用此cms的用户，需要确保apache配置文件中，AllowOverride值为All