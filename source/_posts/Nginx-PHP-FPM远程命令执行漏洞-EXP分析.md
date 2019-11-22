---
title: Nginx+PHP-FPM远程命令执行漏洞_EXP分析
date: 2019-11-04 16:14:49
tags: web漏洞分析
categories: 技术
---

[![KxEii4.md.jpg](https://s2.ax1x.com/2019/11/04/KxEii4.md.jpg)](https://imgchr.com/i/KxEii4)

PHP 官方披露了Nginx + php-fpm 部分配置下存在的远程代码执行高危漏洞，攻击者可利用漏洞对目标网站进行远程代码执行攻击。

本文只针对此次攻击所用到的EXP进行分析，并不涉及漏洞原理分析

漏洞EXP下载地址

https://github.com/neex/phuip-fpizdam

<!--more-->

## 流程

### 两个重要的函数

#### RequestWithQueryStringPrefix方法

RequestWithQueryStringPrefix方法

[![KxkPmT.md.png](https://s2.ax1x.com/2019/11/04/KxkPmT.md.png)](https://imgchr.com/i/KxkPmT)

RequestWithQueryStringPrefix方法用来发送构造的get请求，该方法接收三个传入参数

pathInfo params prefix

比较关键的参数是前两个，即pathInfo与params

在发送数据包前，RequestWithQueryStringPrefix方法会用pathInfo与params计算与构造两部分数据

1、GET 参数中补字符Q个数

RequestWithQueryStringPrefix方法会计算qslPrime值用以在get请求参数中补”Q”字符，如下图

[![Kxk9XV.md.png](https://s2.ax1x.com/2019/11/04/Kxk9XV.md.png)](https://imgchr.com/i/Kxk9XV)

qslPrime值计算如下

[![KxkQ0O.md.png](https://s2.ax1x.com/2019/11/04/KxkQ0O.md.png)](https://imgchr.com/i/KxkQ0O)

可见是由params.QueryStringLength值、qslDelta值 prefix长度值计算得来

params.QueryStringLength，这个值由调用RequestWithQueryStringPrefix方法时作为第二个参数传入的params中取得

prefix值由RequestWithQueryStringPrefix方法用来调用时传入

[![Kvb7Lt.md.png](https://s2.ax1x.com/2019/11/04/Kvb7Lt.md.png)](https://imgchr.com/i/Kvb7Lt)

qslDelta值计算如下

[![KvbbeP.md.png](https://s2.ax1x.com/2019/11/04/KvbbeP.md.png)](https://imgchr.com/i/KvbbeP)

其中pathInfo为值由RequestWithQueryStringPrefix方法用来调用时传入，以baseStatus探测阶段为例(见下文)：

![Kvbqdf.png](https://s2.ax1x.com/2019/11/04/Kvbqdf.png)

pathInfo：/path\\ninfo.php

r.u.EscapedPath()值：

![KvbLo8.png](https://s2.ax1x.com/2019/11/04/KvbLo8.png)

r.u.EscapedPath()：/index.php

u.EscapedPath()值计算如下：

u := \*r.u

u.Path = u.Path + pathInfo

在此例中，u.EscapedPath() 值为/index.php/path%0Ainfo.php

qslDelta 最终长度计算可化简为：len(“%0A”)-len(“\\n”)=2

此例中，qslPrime最终值为1499，如下图

[![KvbXFS.md.png](https://s2.ax1x.com/2019/11/04/KvbXFS.md.png)](https://imgchr.com/i/KvbXFS)

最终在GET请求参数部分补充1499个Q

![KvbjJg.png](https://s2.ax1x.com/2019/11/04/KvbjJg.png)

2、Header头D-Pisos字段补充等号个数

[![KvbvWQ.md.png](https://s2.ax1x.com/2019/11/04/KvbvWQ.md.png)](https://imgchr.com/i/KvbvWQ)

Header头D-Pisos字段值计算如上，其中补充等号个数为params.PisosLength的值，这个值由调用RequestWithQueryStringPrefix方法时作为第二个参数传入的params中取得

最终发包如下

[![Kvbxzj.md.png](https://s2.ax1x.com/2019/11/04/Kvbxzj.md.png)](https://imgchr.com/i/Kvbxzj)

#### MakePathInfo方法

MakePathInfo方法将传入的参数值前拼接/PHP_VALUE\\n，并赋值pi

[![KvqSQs.md.png](https://s2.ax1x.com/2019/11/04/KvqSQs.md.png)](https://imgchr.com/i/KvqSQs)

在计算PosOffset值(固定长为34)与pi长度差后，在pi字符串后拼接对应长度差个数的;

如下图

[![Kvq9Lq.md.png](https://s2.ax1x.com/2019/11/04/Kvq9Lq.md.png)](https://imgchr.com/i/Kvq9Lq)

例如传入phpValue值为\\nsession.auto_start=1

最终返回值为/PHP_VALUE\\nsession.auto_start=1;;;

### baseStatus探测阶段

发送位置：

位于detect.go 32行

[![KvqPe0.md.png](https://s2.ax1x.com/2019/11/04/KvqPe0.md.png)](https://imgchr.com/i/KvqPe0)

发包次数：

1次

补位数据个数：

Q个数1499、等号个数1

Payload:

/path\\ninfo.php

数据包

[![KvqiwV.md.png](https://s2.ax1x.com/2019/11/04/KvqiwV.md.png)](https://imgchr.com/i/KvqiwV)

作用：通过这次发包，确定目标系统的baseStatus，如果本次发包返回状态码为200，则后续baseStatus为200

详情：

main.go中82行处调用Detect

[![KvqFoT.md.png](https://s2.ax1x.com/2019/11/04/KvqFoT.md.png)](https://imgchr.com/i/KvqFoT)

[![KvqAFU.md.png](https://s2.ax1x.com/2019/11/04/KvqAFU.md.png)](https://imgchr.com/i/KvqAFU)

Detect调用requester.Request发包

requester.Request方法如下

[![KvqEYF.md.png](https://s2.ax1x.com/2019/11/04/KvqEYF.md.png)](https://imgchr.com/i/KvqEYF)

requester.Request调用RequestWithQueryStringPrefix方法发包

[![KvqVW4.md.png](https://s2.ax1x.com/2019/11/04/KvqVW4.md.png)](https://imgchr.com/i/KvqVW4)

通过本次发包返回的状态码，确定目标系统的baseStatus

### Q字符长度候选值确认阶段

发送位置：

位于detect.go 47行

[![KvqeSJ.md.png](https://s2.ax1x.com/2019/11/04/KvqeSJ.md.png)](https://imgchr.com/i/KvqeSJ)

发包次数：

91次

补位数据个数：

Q个数1499-1949步长5递增、等号个数1

Payload:

/PHP\\nis_the_shittiest_lang.php

数据包

[![Kvqml9.md.png](https://s2.ax1x.com/2019/11/04/Kvqml9.md.png)](https://imgchr.com/i/Kvqml9)

作用：

确认导致返回状态码异于baseStatus的Q长度加入qsl候选列表(qslCandidates)，候选列表中还有其长度减五以及减十这两个候选值

详情：

此处发包，位于一处for循环中

其中MaxQSl、MinQSL、QSLDetectStep值如下图

![KvqnyR.png](https://s2.ax1x.com/2019/11/04/KvqnyR.png)

可见该循环一个可以循环91次

![KvquO1.png](https://s2.ax1x.com/2019/11/04/KvquO1.png)

仍然调用RequestWithQueryStringPrefix方法发包

对应传入RequestWithQueryStringPrefix方法的pathInfo为BreakingPayload，params

为ap

BreakingPayload值如下图

![KvqMex.png](https://s2.ax1x.com/2019/11/04/KvqMex.png)

Ap值如下图

[![KvqQw6.md.png](https://s2.ax1x.com/2019/11/04/KvqQw6.md.png)](https://imgchr.com/i/KvqQw6)

即对应的params.PisosLength值也就是补充等号个数为1，对应的params.QueryStringLength值为qsl，随循环递增

[![KvqlTK.md.png](https://s2.ax1x.com/2019/11/04/KvqlTK.md.png)](https://imgchr.com/i/KvqlTK)

当Q长度使得返回状态码异于baseStatus，将这个Q长度值保存到qslCandidates列表中

### sanity check阶段 

发送位置：

位于detect.go 116行

[![Kvq3FO.md.png](https://s2.ax1x.com/2019/11/04/Kvq3FO.md.png)](https://imgchr.com/i/Kvq3FO)

发包次数：

10次

补位数据个数：

Q个数1949、等号个数256

Payload:

/PHP\\nSOSAT

数据包

[![Kvq8YD.md.png](https://s2.ax1x.com/2019/11/04/Kvq8YD.md.png)](https://imgchr.com/i/Kvq8YD)

作用：

进行sanity check
操作，当此处数据包返回状态码与baseStatus值相同，且header头部不存在包含PHPSESSID字符串的set-cookie字段时，通过检测，反之，程序结束

详情：

SanityCheck方法在Detect方法中调用,如下图

[![KvqGfe.md.png](https://s2.ax1x.com/2019/11/04/KvqGfe.md.png)](https://imgchr.com/i/KvqGfe)

可见此处也存在一个for循环，最多可以循环发包10次

[![KvqYSH.md.png](https://s2.ax1x.com/2019/11/04/KvqYSH.md.png)](https://imgchr.com/i/KvqYSH)

SanityCheck方法仍然调用RequestWithQueryStringPrefix方法，

此时pathInfo为"/PHP\\nSOSAT"，params.PisosLength值为256，补256个等号

循环发送10次

[![Kvqtld.md.png](https://s2.ax1x.com/2019/11/04/Kvqtld.md.png)](https://imgchr.com/i/Kvqtld)

检测sanity部分代码如下

[![KvqN6A.md.png](https://s2.ax1x.com/2019/11/04/KvqN6A.md.png)](https://imgchr.com/i/KvqN6A)

### Q字符长度以及等号个数确认阶段

发送位置：

位于detect.go 96行

[![KvqUOI.md.png](https://s2.ax1x.com/2019/11/04/KvqUOI.md.png)](https://imgchr.com/i/KvqUOI)

发包次数：

最大50\*3\*256次，当响应包header头存在set-cookie字段，且字段中存在PHPSESSID字符串时终止发包

补位数据个数：

Q个数qslCandidates -1/ qslCandidates -5 -1/ qslCandidates -10 -1
随中层三次循环变化、等号个数1-256随内层循环变化

数据包

[![Kvqdmt.md.png](https://s2.ax1x.com/2019/11/04/Kvqdmt.md.png)](https://imgchr.com/i/Kvqdmt)

[![Kvqw0P.md.png](https://s2.ax1x.com/2019/11/04/Kvqw0P.md.png)](https://imgchr.com/i/Kvqw0P)

[![Kvq0Tf.md.png](https://s2.ax1x.com/2019/11/04/Kvq0Tf.md.png)](https://imgchr.com/i/Kvq0Tf)

作用：

分别尝试Q的个数为qslCandidates-1长度、qslCandidates-5-1、qslCandidates-10-1长度下，等号个数从1到256的请求的不同效果。

找到当响应包header头存在set-cookie字段，且字段中存在PHPSESSID字符串时，对应的Q个数以及等号个数，共后续攻击利用

详情：

此处发包位于Detect方法中96行处

[![KvqDk8.md.png](https://s2.ax1x.com/2019/11/04/KvqDk8.md.png)](https://imgchr.com/i/KvqDk8)

可见存在一个三层嵌套循环

外层for循环50次，中层循环3次，内层循环256次

在内层循环里，即上图96行处，仍然使用RequestWithQueryStringPrefix方法发包

Payload值获取于Detect方法中87行处的MakePathInfo方法中,如下图

[![KvqrtS.md.png](https://s2.ax1x.com/2019/11/04/KvqrtS.md.png)](https://imgchr.com/i/KvqrtS)

传入MakePathInfo方法中的值为method.PHPOptionEnable

[![Kvqsfg.md.png](https://s2.ax1x.com/2019/11/04/Kvqsfg.md.png)](https://imgchr.com/i/Kvqsfg)

即session.auto_start=1

在MakePathInfo方法中，将传入的phpValue参数值前拼接/PHP_VALUE\\n，并赋值pi

[![Kvq6pQ.md.png](https://s2.ax1x.com/2019/11/04/Kvq6pQ.md.png)](https://imgchr.com/i/Kvq6pQ)

计算PosOffset值(固定34)与pi长度差并在pi后拼接对应长度差个数的;如下图

[![Kvqclj.md.png](https://s2.ax1x.com/2019/11/04/Kvqclj.md.png)](https://imgchr.com/i/Kvqclj)

最终payload即pathInfo为/PHP_VALUE\\nsession.auto_start=1;;;

params.QueryStringLength值与params.PisosLength值获取于Detect方法中95行处qsl与pl，如下图

[![Kvqg6s.md.png](https://s2.ax1x.com/2019/11/04/Kvqg6s.md.png)](https://imgchr.com/i/Kvqg6s)

qsl值为中层循环时遍历数组qslCandidates中的值，qslCandidates中的值如下图，分别为1785/1790/1795，这个列表值是由Q字符长度候选值确认阶段计算的候选Q长度值减5以及减10得来

![Kvq2Xn.png](https://s2.ax1x.com/2019/11/04/Kvq2Xn.png)

Pl值为内层循环时遍历数组plCandidates中的值，plCandidates中的值如下图，分别为1-256

[![Kvqf00.md.png](https://s2.ax1x.com/2019/11/04/Kvqf00.md.png)](https://imgchr.com/i/Kvqf00)

会随着内层循环从0递增，因此最终补充的等号个数逐渐从1个随发包递增-置1-递增。

params.QueryStringLength值获取与

当返回值满足如下if分支时，循环结束

[![Kvq5kT.md.png](https://s2.ax1x.com/2019/11/04/Kvq5kT.md.png)](https://imgchr.com/i/Kvq5kT)

跟入method.Check方法，如下图

[![KvqItU.md.png](https://s2.ax1x.com/2019/11/04/KvqItU.md.png)](https://imgchr.com/i/KvqItU)

当响应包header头存在set-cookie字段，且字段中存在PHPSESSID字符串，则method.Check方法返回true，循环终止。返回params值(params.PisosLength/params.QueryStringLength)共后续发包使用

满足条件的数据包如下

[![KvqohF.md.png](https://s2.ax1x.com/2019/11/04/KvqohF.md.png)](https://imgchr.com/i/KvqohF)

当三层循环完全结束后，仍无满足条件的响应数据包，程序返回not vulnerable or other
failure

当该过程结束后，会再次发送50个数据包，试图将session.auto_start设置回0

### 修改PHP.ini阶段 

发送位置：

位于attack.go 33行

[![Kvq7p4.md.png](https://s2.ax1x.com/2019/11/04/Kvq7p4.md.png)](https://imgchr.com/i/Kvq7p4)

发包次数：

不定，直到响应数据包body中存在"/bin/which"字符串后停止发包

补位数据个数：

Q个数以及等号个数由上一阶段(Q字符长度以及等号个数确认阶段)确定

Payload:

循环发送chain数组值

数据包

[![KvqH1J.md.png](https://s2.ax1x.com/2019/11/04/KvqH1J.md.png)](https://imgchr.com/i/KvqH1J)

作用：

修改php.ini

详情：

Attack方法位于main.go 103行被调用，接收上一阶段得出的params值进行payload计算

[![Kvqbc9.md.png](https://s2.ax1x.com/2019/11/04/Kvqbc9.md.png)](https://imgchr.com/i/Kvqbc9)

跟入Attack方法

[![KvqqXR.md.png](https://s2.ax1x.com/2019/11/04/KvqqXR.md.png)](https://imgchr.com/i/KvqqXR)

可见存在两大段for循环块

首先看第一段for循环，该处for循环中嵌套一层循环

[![KvqOn1.md.png](https://s2.ax1x.com/2019/11/04/KvqOn1.md.png)](https://imgchr.com/i/KvqOn1)

从chain中取payload，并传递给SetSettingSingle发包

Chain值如下

![KvqX0x.png](https://s2.ax1x.com/2019/11/04/KvqX0x.png)

SetSettingSingle方法

[![Kvqj76.md.png](https://s2.ax1x.com/2019/11/04/Kvqj76.md.png)](https://imgchr.com/i/Kvqj76)

SetSettingSingle方法首先调用MakePathInfo处理payload，如上图29行，接着调用RequestWithQueryStringPrefix方法发包

此时PathInfo值为
/PHP_VALUE/nsession.auto_start=0;;;形式，其中session.auto_start=0为遍历chain中值

其中Q的个数与等号个数，又上一步返回的params值来计算

发包结果如下

[![KvqxAK.md.png](https://s2.ax1x.com/2019/11/04/KvqxAK.md.png)](https://imgchr.com/i/KvqxAK)

![KvqztO.png](https://s2.ax1x.com/2019/11/04/KvqztO.png)

只有当返回body中存在successPattern值时，最外层for循环才会结束，否则一直循环发送chain中的值。如下图

[![KvLShD.md.png](https://s2.ax1x.com/2019/11/04/KvLShD.md.png)](https://imgchr.com/i/KvLShD)

successPattern 值为"/bin/which"，如下图

[![KvL99e.md.png](https://s2.ax1x.com/2019/11/04/KvL99e.md.png)](https://imgchr.com/i/KvL99e)

最终结束时的返回包如下

[![KvLC1H.md.png](https://s2.ax1x.com/2019/11/04/KvLC1H.md.png)](https://imgchr.com/i/KvLC1H)

### 写入后门阶段

发送位置：

位于attack.go 48行

[![KvLPcd.md.png](https://s2.ax1x.com/2019/11/04/KvLPcd.md.png)](https://imgchr.com/i/KvLPcd)

发包次数：

不定，直到响应数据包body中存在"/bin/which"字符串后停止发包

补位数据个数：

Q个数以及等号个数由Q字符长度以及等号个数确认阶段确定

Payload:

/

数据包

[![KvLijA.md.png](https://s2.ax1x.com/2019/11/04/KvLijA.md.png)](https://imgchr.com/i/KvLijA)

作用：

清空tmp\\a，并在tmp\\a中写入payload

详情：

此处发包位于Attack方法中的第二个for循环块

[![KvLknI.md.png](https://s2.ax1x.com/2019/11/04/KvLknI.md.png)](https://imgchr.com/i/KvLknI)

同上一个(修改PHP.ini阶段)相似，也是调用RequestWithQueryStringPrefix方法发包

此时PathInfo值为”/”，
params值使用的是由Q字符长度以及等号个数确认阶段中得出的params值

发包结果如下

[![KvLABt.md.png](https://s2.ax1x.com/2019/11/04/KvLABt.md.png)](https://imgchr.com/i/KvLABt)

当返回body中存在/bin/which时，发包结束