---
title: XMLDecoder解析流程以及历史绕过分析
date: 2019-10-27 18:07:52
tags: [web漏洞分析 ,java]
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/c731555993eb4ce02be0ed40e046e8d.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

Weblogic曾出现过多个与XMLDecoder相关的漏洞(CVE-2017-3506、CVE-2017-10352、CVE-2019-2725)。

Weblogic针对于漏洞的修复，往往是增加黑名单以限制xml中的元素，例如针对CVE-2017-3506的修复方法，限制了object标签使得攻击者无法创建指定类的实例。但是攻击者可以使用void、new来代替object，从而造成了CVE-2017-10352漏洞的产生。

那为什么在XMLDecoder解析时，可以使用void、new来代替object呢？本文将详细的分析XMLDecoder代码，以找到答案。

<!--more-->

基础概念
--------

XMLDecoder用于将XMLEncoder创建的xml文档内容反序列化为一个Java对象,简单的案例可见官方给出的下图代码

![laapB4.png](https://s2.ax1x.com/2020/01/03/laapB4.png)

首先，我们写一个简单的测试demo TestStudent类

![laaE36.png](https://s2.ax1x.com/2020/01/03/laaE36.png)

TestStudent类中将完成从XMLEncoder到XMLDecoder的过程

Student类如下图

![laaF41.png](https://s2.ax1x.com/2020/01/03/laaF41.png)

首先看下XML编码以及写入文件过程，见下图红框处

![laanDe.png](https://s2.ax1x.com/2020/01/03/laanDe.png)

在程序将Student类的实例在XML编码后写入student.xml，student.xml文件如下图

![laal4I.png](https://s2.ax1x.com/2020/01/03/laal4I.png)

接下来，程序将读取student.xml文件内容，并进行xml反序列化

![laU5jS.png](https://s2.ax1x.com/2020/01/03/laU5jS.png)

XMLDecoder反序列化
------------------

为了研究xmldecoder是如何进行反序列化，以及文章开头我们提出的问题，我们跟一下代码

在readObject方法上下断，如下图

![laagrF.png](https://s2.ax1x.com/2020/01/03/laagrF.png)

之后的调用栈特别的深，从我们TestStudent中的readObject到DocumentHandler类中的startElement方法。具体可以见下图

![laUDXD.png](https://s2.ax1x.com/2020/01/03/laUDXD.png)

之所以我们要在DocumentHandler中的startElement下断点，是因为DocumentHandler继承自DefaultHandler。DefaultHandler是使用SAX进行XML解析的默认Handler。因此DocumentHandler相当于xml解析的开始，而startElement是开始标签处理函数，包括属性的添加，因此我们从开始标签处理处着手跟入。

但是在正式跟入前，我们首先看下DocumentHandler的构造方法

![laatKS.png](https://s2.ax1x.com/2020/01/03/laatKS.png)

上图构造方法中，定义了可以解析的xml元素以及它们对应的使用的解析器

关于这点，我们正式跟入startElement中的断点，从下图startElement中看到

![laURht.png](https://s2.ax1x.com/2020/01/03/laURht.png)

在this.handlers列表中，这里包含了各个xml元素对应使用的解析器

对照我们的xml文件

![lryAAI.png](https://s2.ax1x.com/2020/01/06/lryAAI.png)

第一个标签是java

Java对应的解析器是JavaElementHandler

![laUwp6.png](https://s2.ax1x.com/2020/01/03/laUwp6.png)

![laa9HJ.png](https://s2.ax1x.com/2020/01/03/laa9HJ.png)

我们先跳过java标签不看，直接看下一个解析的标签

![laaMEd.png](https://s2.ax1x.com/2020/01/03/laaMEd.png)

下一个标签就是重要的object标签

根据对应关系，进入ObjectElementHandler解析器，见下图

![laamuD.png](https://s2.ax1x.com/2020/01/03/laamuD.png)

从上图可见ObjectElementHandler 继承了 NewElementHandler类

而NewElementHandler类，正是new标签对应的解析类，见下图

![laa3Ct.png](https://s2.ax1x.com/2020/01/03/laa3Ct.png)

这里已经涉及到为什么可以用new代替object的部分原因了，但是不是确凿证据。记住这里的继承关系，我们接着看ObjectElementHandler类

在ObjectElementHandler类中，存在一个addAttribute方法，见下图

![laUh1f.png](https://s2.ax1x.com/2020/01/03/laUh1f.png)

addAttribute的作用是在解析对应标签时，为标签对象添加相应的属性

这里我们解析的时object标签，而我们的object标签中只有class属性，见下图

![laa88P.png](https://s2.ax1x.com/2020/01/03/laa88P.png)

当然，如果有idref、field、index、method等等，程序会将其值赋值给对应的属性

例如下图，object有index属性

![laUj3V.png](https://s2.ax1x.com/2020/01/03/laUj3V.png)

那么这里的this.index就为”xxx”

回到正文，由于上述属性我们的xml object里都没有，直接进入下图断点

![laaA9x.png](https://s2.ax1x.com/2020/01/03/laaA9x.png)

调用父类NewElementHandler的addAttribute方法

![laaQUA.png](https://s2.ax1x.com/2020/01/03/laaQUA.png)

NewElementHandler中addAttribute方法为对象添加class属性

这样看来，需要继承NewElementHandler类的标签解析器，对应的标签默认都有class属性。因为这些标签默认都有class属性，因此直接继承NewElementHandler类中addAttribute方法对class属性进行赋值，这样就不用一一重写了。

为了证明一下我的观点，我们跳出测试xml文件，直接看一下weblogic的漏洞利用的poc

![lryENt.png](https://s2.ax1x.com/2020/01/06/lryENt.png)

可见java标签、object标签、array标签，都有class属性

![laaZjO.png](https://s2.ax1x.com/2020/01/03/laaZjO.png)

array标签的解析器也继承了NewElementHandler

![laUTBQ.png](https://s2.ax1x.com/2020/01/03/laUTBQ.png)

由于java标签要处理version，于是自己实现了class标签处理而非继承NewElementHandler

回到调试流程中，在NewElementHandler的addAttribute方法中进行class属性赋值

![laUUt1.png](https://s2.ax1x.com/2020/01/03/laUUt1.png)

![laU01K.png](https://s2.ax1x.com/2020/01/03/laU01K.png)

经过class赋值后，object标签的tpye属性已经为我们的Student类对象

接下来，程序将逐一为我们的xml里的标签进行addAttribute属性赋值操作，从java标签到object标签到void等等

当DocumentHandler中的startElement这个过程结束后，程序将调用endElement方法，endElement方法为结束标签处理函数，见下图

![laUxjU.png](https://s2.ax1x.com/2020/01/03/laUxjU.png)

endElement方法中将调用getValueObject方法获取每一个标签所产生的对象对应的ValueObject实例

我们直接跳转到对object标签的处理

![laadEj.png](https://s2.ax1x.com/2020/01/03/laadEj.png)

![laaVgK.png](https://s2.ax1x.com/2020/01/03/laaVgK.png)

从上图可见，程序直接通过Expression生成实例。这里对应生成了我们的Student类的实例

XMLDecoder反序列化的流程就是上文分析的这样，那为什么可以用new、代替object呢？

### 为什么可以用new替换object

还记不记得上文这里

![laaUbQ.png](https://s2.ax1x.com/2020/01/03/laaUbQ.png)

当解析object标签，用的是ObjectElementHandler解析器，而ObjectElementHandler继承了NewElementHandler。更重要的是，在将object中class属性进行赋值时，用的仍然是NewElementHandler中的addAttribute方法。New标签直接使用NewElementHandler进行解析。因此二者最终进行我们Student类实例的赋值操作是完全一样的

### 为什么可以用void替换object

经过上文的分析，这个问题更简单了，我们看下void标签的解析器

![laUbAs.png](https://s2.ax1x.com/2020/01/03/laUbAs.png)

void标签的解析器是VoidElementHandler，这个解析器直接继承了ObjectElementHandler，并且仅仅重写了isArgument方法,而这个方法在我们反序列化利用的过程中并无影响

### 为什么可以用method替换object

这个问题也比较简单，我们看下method标签的解析器

![laaiNR.png](https://s2.ax1x.com/2020/01/03/laaiNR.png)

可见与object一样，也是继承了NewElementHandler类。与此同时，于object类中的addAttribute方法中类似，也是使用NewElementHandler类中的addAttribute方法处理class属性。Method与Object标签解析器实现的方式几乎一摸一样，因此可以用method代替object