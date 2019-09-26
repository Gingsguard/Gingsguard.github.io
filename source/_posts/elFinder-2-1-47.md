---
title: 空安全意识，撸码一时手抖 elFinder-2.1.47代码执行漏洞-CVE-2019-9194详解
date: 2019-03-22 14:17:21
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2019/05/500965202_wx.jpg)

CVE-2019-9194，这是一个很神奇的漏洞。
开发者在漏洞的上一行，用了过滤方法对传入的参数进行过滤，然而到了下一行，却手一抖，直接用传入的未过滤的参数拼接cmd，进行执行，造成了远程代码执行漏洞。

## 漏洞分析
elFinder是一个用于Web的开源文件管理器，使用jQuery UI以JavaScript编写。创作的灵感来自于Mac OS X操作系统中使用的Finder程序的简单性和便利性。

相关的漏洞说明可以见如下packet storm的链接：
https://packetstormsecurity.com/files/151960/elFinder-2.1.47-Command-Injection.html

elFinder这个项目可以在github上找到，该项目的star数为3195，可见此次漏洞影响范围还是不小的。

本次漏洞是在2.1.48版本修复的，官方在readme中强调需要升级最新的版本以修复该漏洞。
![1.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315164505-a1b0bc52-46fe-1.png)

现在来看一下2.1.48中是如何修复的，以便于我们找到这个漏洞的触发点。

不得不吐槽，这个项目的版本控制很奇怪。。。
按照以往经验，既然在下一个版本修复的，那我们就应该在下一个版本的release commits中寻找修复方案
![2.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315164545-b9793f1c-46fe-1.png)
但是这7个commits里并没有关于漏洞的修复，至少看起来都不像是修复漏洞用的。

仔细研究里下他的提交记录后，发现这个项目是在2.1这个版本上进行修改，然后release 不同的版本（2.1.47/2.1.48/）
其实从2.1.48release的记录上来看，7 commits to 2.1 since this release 就可以看出来了，48版本并不是在47版本上修改得来的，所以看48的release没有用。
这里应该看2.1.47的
![3.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315164611-c89165f6-46fe-1.png)
由于改动都是在2.1上进行的，因此比较2.1与2.1.47之间的commits就可以找到47漏洞所在了。

漏洞位于php/elFinderVolumeDriver.class.php中的imgRotate方法中
![4.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315164639-d9b04faa-46fe-1.png)
从这里的修复来看，漏洞触发点一定是位于这里。

可以看见修复有两点：
其一：使用$quotedPath替换原来的$path参数，这个$quotedPath一直存在，可见开发者还是有安全意识的，但是在写代码时候估计是写错了。
其二：用 “--”来来结束后面的参数选项  


![5.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315164955-4e81a590-46ff-1.png)
这里可以参见命令行解析器中，“--”的意思，“-- 表示选项结束并禁用进一步的选项处理。 -- 之后的任何参数都被视为文件名和参数。”

也就是说，可以有效的防止了传入参数选项而绕过escapeshellarg，可以参见gitlist 0.6.0远程命令执行漏洞。
通过分析补丁，我们已经摸清触发点所在，并且了解是如何修复的，下面来看下漏洞是如何利用的。

首先跟一下存在漏洞的函数 imgRotate，看看被哪个方法调用

位于\php\elFinderVolumeDriver.class.php中的resize方法中调用imgRotate方法

![7.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165038-67c1d7aa-46ff-1.png)
可见这里的$work_path被传入imgRotate中

而在imgRotate中，此$path 参数被直接拼到$cmds[]中，如下图：
![8.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165055-7244dcc2-46ff-1.png)
拼接后的$cmds[]接着被遍历传入proExec中执行

proExec代码如下
![9.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165112-7c086f26-46ff-1.png)

也就是说，如果这个$work_path可控，那么就会导致代码执行。

看一下漏洞利用poc

首先，上传一个图片，图片名为构造好的poc

![10.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165202-9a147032-46ff-1.png)

通过返回的json，可以知道该图片的hash值

用该hash值构造请求，以剪裁改图片

![11.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165233-ac528932-46ff-1.png)
在检测图片过程中，由于path为我们构造的恶意数据，导致代码执行。

运行一下packetstorm上给出的poc

![12.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165247-b4d04eb4-46ff-1.png)
直接跳到resize部分

![13.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165301-bcd7c312-46ff-1.png)
这里的$path值是由上传的图片的hash解码出来的，可见我们构造的数据被包含在其中。

接着，$path值传递给$work_path

![14.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165318-c708b1ac-46ff-1.png)

接着$work_path传入imgRotate中
![15.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165334-d0b4e5ae-46ff-1.png)

接着，我们构造的参数被拼接到$cmds[]中
![16.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165352-db43f320-46ff-1.png)

最后，拼接完成的指令被传入procExec中的proc_open方法

![17.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165411-e6ccc762-46ff-1.png)

构造好的代码最终被执行
![18.png](https://xzfile.aliyuncs.com/media/upload/picture/20190315165437-f648993c-46ff-1.png)

## 写在后面
这个漏洞如果想成功利用，目标服务器上需装有exiftran,否则无法复现该漏洞