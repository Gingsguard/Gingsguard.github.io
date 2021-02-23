---
title: Fastjson 1.2.24反序列化漏洞深度分析
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/Hippopx(1).jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
date: 2020-07-17 11:05:38
---

 Fastjson 1.2.24反序列化漏洞深度分析
====================================

前言
----

FastJson是alibaba的一款开源JSON解析库，可用于将Java对象转换为其JSON表示形式，也可以用于将JSON字符串转换为等效的Java对象。近几年来fastjson漏洞层出不穷，本文将会谈谈近几年来fastjson RCE漏洞的源头：17年fastjson爆出的1.2.24反序列化漏洞。以这个漏洞为基础，详细分析fastjson漏洞的一些细节问题。

关于Fastjson 1.2.24反序列化漏洞，自从17年以来已经有很多人分析过了，一些基础内容本文就不再陈述了。此次漏洞简单来说，就是Fastjson通过parseObject/parse将传入的字符串反序列化为Java对象时由于没有进行合理检查而导致的

本文将着重分析一下这个漏洞没有被详细介绍过的细节问题，如下：

1.  parseObject(String text) 、parse (String text)、 parseObject(String text, Class\<T\> clazz)三个方法从代码层面上来看，究竟有何不同？
2. 使用TemplatesImpl攻击调用链路构造poc时，为什么一定需要构造_tfactory以及_name字段？
3. _outputProperties与其getter方法getOutputProperties()方法名字并不完全一致是如何解决的？

除此之外，本文在介绍TemplatesImpl攻击调用链路时，以模拟寻找漏洞利用链的思路，从最终的执行点开始向上寻找入口，模拟还原出挖掘这个TemplatesImpl利用链的完整过程。

漏洞分析
--------

关于parse (String text) 、parseObject(String text)、 parseObject(String text, Class\<T\> clazz)三个方法，我们进行一个测试

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2a482f1a4f410547c0ac9a3b7876dffa.png)

FastJsonTest类中变量以及其setter/getter关系如下表

|        | public String t1 | private int t2 | private Boolean t3 | private Properties t4 | private Properties t5 |
| ------ | ---------------- | -------------- | ------------------ | --------------------- | --------------------- |
| setter | 有               | 有             | 无                 | 无                    | 有                    |
| getter | 有               | 有             | 有                 | 有                    | 有                    |

接下来，我们分别使用下图三种方式分别将JSON字符串反序列化成Java对象

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/a5968e24e6caa97be9562234c80400e8.png)

1. Object obj = JSON.parse(jsonstr);
2. Object obj = JSON.parseObject(jsonstr, FastJsonTest.class);
3. Object obj = JSON.parseObject(jsonstr);

首先我们运行一下Object obj = JSON.parse(jsonstr);这种方式

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/d4d30014d4d24a2897bfa65da386fec4.png)

结果：

- setT1() 、setT2() 、getT4() 、setT5() 被调用

- JSON.parse(jsonstr)最终返回FastJsonTest类的对象

接着我们运行下Object obj = JSON.parseObject(jsonstr, FastJsonTest.class);

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/888051938003f40fb97aa91a724e5887.png)

结果：

- 与JSON.parse(jsonstr);这种方式一样setT1() 、setT2() 、getT4() 、setT5() 被调用

- JSON.parse(jsonstr)最终返回FastJsonTest类的对象

最后我们运行下Object obj = JSON.parseObject(jsonstr);

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/21c2453ce372bcfc605f96bb97a9fdc4.png)

结果：

- 这次结果与上两次大不相同，FastJsonTest类中的所有getter与setter都被调用
- JSON.parseObject(jsonstr);返回一个JSONObject对象

通过上文运行结果，不难发现有三个问题

1. 使用JSON.parse(jsonstr);与JSON.parseObject(jsonstr, FastJsonTest.class);两种方式执行后的返回结果完全相同，且FastJsonTest类中getter与setter方法调用情况也完全一致，parse(jsonstr)与parseObject(jsonstr, FastJsonTest.class)有何关联呢？
2. 使用JSON.parse(jsonstr);与JSON.parseObject(jsonstr, FastJsonTest.class);两种方式时，被调用的getter与setter方法分别为setT1()、setT2()、setT5()、getT4()。FastJsonTest类中一共有五个getter方法，分别为getT1()、getT2()、getT3()、getT4()、getT5()，为什么仅仅getT4被调用了呢?
3. JSON.parseObject(jsonstr);为什么返回值为JSONObject类对象，且将FastJsonTest类中的所有getter与setter都被调用了?

### 问题一解答

>  使用JSON.parse(jsonstr);与JSON.parseObject(jsonstr, FastJsonTest.class);两种方式执行后的返回结果完全相同，且FastJsonTest类中getter与setter方法调用情况也完全一致，parse(jsonstr)与parseObject(jsonstr, FastJsonTest.class)有何关联呢？

经过调试可以发现，无论使用JSON.parse(jsonstr);或是JSON.parseObject(jsonstr, FastJsonTest.class);方式解析json字符串，程序最终都会调用位于com/alibaba/fastjson/util/JavaBeanInfo.java中的JavaBeanInfo.build()方法来获取并保存目标Java类中的成员变量以及其对应的setter、getter

首先来看下JSON.parse(jsonstr)这种方式，当程序执行到JavaBeanInfo.build()方法时情景如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/0c9cd8220940fbcb60fc3bb987a34b15.png)

此时的调用链如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1f5f848eaa7b8c1af2ea4febf61ba3a9.png)

此时传入JavaBeanInfo.build() 方法的参数值如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/3bd0543cc0dc52a33e44fca9b345c270.png)

再来看下JSON.parseObject(jsonstr, FastJsonTest.class)这种方式，当程序执行到JavaBeanInfo.build() 方法时情景如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/440177acd687179a1be554c61759897f.png)

此时的调用链如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/d05b4a2272ab1219c192345455013b0c.png)

此时传入JavaBeanInfo.build() 方法的参数值如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/80d1735b7c2742cf729ba6729b5e189e.png)

二者执行到JavaBeanInfo.build() 方法时调用链对比如下

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/21ee55654a62cb8f7750458052485dfe.png)

可见二者后面的调用链是完全一样的。二者不同点在于调用JavaBeanInfo.build()
方法时传入clazz参数的来源不同：

- JSON.parseObject(jsonstr, FastJsonTest.class)在调用JavaBeanInfo.build()方法时传入的clazz参数源于parseObject方法中第二个参数中指定的“FastJsonTest.class”。

- JSON.parse(jsonstr);这种方式调用JavaBeanInfo.build()方法时传入的clazz参数获取于json字符串中\@type字段的值。

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/f0c8407956fe7df0df4b42b3199b6e2a.png)

关于JSON.parse(jsonstr);从json字符串中\@type字段获取clazz参数，具体代码如下

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2757daa1052b75266d159af6096ed25e.png)

程序通过解析传入的json字符串的\@type字段值来获取之后传入JavaBeanInfo.build()方法的clazz参数

因此，只要Json字符串的\@type字段值与JSON.parseObject(jsonstr, FastJsonTest.class);中第二个参数中类名一致，见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2d3c790ca89e2d2ed8999c4f170ffe92.png)

JSON.parse(jsonstr)与JSON.parseObject(jsonstr, FastJsonTest.class)这两种方式执行的过程与结果是完全一致的。二者唯一的区别就是获取clazz参数的途径不同

### 问题二解答

>   使用JSON.parse(jsonstr)与JSON.parseObject(jsonstr, FastJsonTest.class)两种方式时，被调用的getter与setter方法分别为setT1()、setT2()、setT5()、getT4()。FastJsonTest类中一共有五个getter方法，分别为getT1()、getT2()、getT3()、getT4()、getT5()，为什么仅仅getT4被调用了呢?

这个问题要从JavaBeanInfo.build() 方法中获取答案：

通过上文的分析可以发现，程序会使用JavaBeanInfo.build()方法对传入的json字符串进行解析。在JavaBeanInfo.build()方法中，程序将会创建一个fieldList数组来存放后续将要处理的目标类的 setter方法及某些特定条件的 getter方法。通过上文的结果可见，目标类中所有的setter方法都可以被调用，但只有getT4()这一个getter被调用，那么到底什么样的getter方法可以满足要求并被加入fieldList数组中呢？

在JavaBeanInfo.build() 方法可见如下代码

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/6ba89b567b638379ac0955cf3ee0e318.png)

程序从clazz（目标类对象）中通过getMethods获取本类以及父类或者父接口中所有的公共方法，接着进行循环判断这些方法是否可以加入fieldList中以便后续处理

条件一、方法名需要长于4

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/3ba4f3c36c37c86019bd3e46a81de0b2.png)

条件二、不是静态方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/d63f0488efd86adc06ef29945da02942.png)

条件三、以get字符串开头，且第四个字符需要是大写字母

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b01f974fd81355c9ace3ba5f6222a4d8.png)

条件四、方法不能有参数传入

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/87ac3c7ff9cb6348d836cf02a97a5f7e.png)

条件五、继承自Collection \|\| Map \|\| AtomicBoolean \|\| AtomicInteger \|\|
AtomicLong

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/95ac194ec336d6e610097b3b038b254b.png)

条件六、此getter不能有setter方法（程序会先将目标类中所有的setter加入fieldList列表，因此可以通过读取fieldList列表来判断此类中的getter方法有没有setter）

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1544f565ed123a2f83dff21f3e2bc05f.png)

### 问题三解答

> JSON.parseObject(jsonstr);为什么返回值为JSONObject类对象，且将FastJsonTest类中的所有getter与setter都被调用了?

通过上文的分析可以发现，JSON.parse(jsonstr)与JSON.parseObject(jsonstr, FastJsonTest.class)两种方式从执行流程几乎一样，结果也完全相同；然而使用JSON.parseObject(jsonstr)这种方式，执行的结果与返回值却与前两者不同：JSON.parseObject(jsonstr)返回值为JSONObject类对象，且将FastJsonTest类中的所有getter与setter都被调用。

通过阅读源码可以发现JSON.parseObject(String text)实现如下

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b856db3404b87d708cd00edfbbd9ee30.png)

parseObject(String text)其实就是执行了parse(),随后将返回的Java对象通过JSON.toJSON（）转为JSONObject对象。

JSON.toJSON()方法会将目标类中所有getter方法记录下来，见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/ce86b2ba9f56c78fdddea1d1e030dedb.png)

随后通过反射依次调用目标类中所有的getter方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/a657b27f84e6bbeeb8f70706ba9108fa.png)

完整的调用链如下

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/c7b24c882c04cc7e6c42a423176985be.png)

总结：

上文例子中，JSON.parse(jsonstr)与JSON.parseObject(jsonstr, FastJsonTest.class)可以认为是完全一样的，而parseObject(String text)是在二者的基础上又执行了一次JSON.toJSON()

parse(String text)、parseObject(String text)与parseObject(String text, Class\<T\> clazz)目标类Setter\\Getter调用情况

|                | parse(String text) | parseObject(String text) | parseObject(String text, Class\<T\> clazz) |
| -------------- | ------------------ | ------------------------ | ------------------------------------------ |
| Setter调用情况 | 全部               | 全部                     | 全部                                       |
| Getter调用情况 | 部分               | 全部                     | 部分                                       |

此外，如果目标类中私有变量没有setter方法，但是在反序列化时仍想给这个变量赋值，则需要使用Feature.SupportNonPublicField参数。（在下文中，为TemplatesImpl类中无setter方法的私有变量_tfactory以及_name赋值运用到的就是这个知识点）

TemplatesImpl攻击调用链路
-------------------------

针对于上文的分析可以发现，无论使用哪种方式处理JSON字符串，都会有机会调用目标类中符合要求的Getter方法

如果一个类中的Getter方法满足调用条件并且存在可利用点，那么这个攻击链就产生了。

TemplatesImpl类恰好满足这个要求：

com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl中存在一个名为_outputPropertiesget的私有变量，其getter方法中存在利用点，这个getter方法恰好满足了调用条件，在JSON字符串被解析时可以调用其在调用FastJson.parseObject()序列化为Java对象时会被调用，下面我们详细说明一下：

首先我们从漏洞点开始，一层层往入口分析：首先看一下TemplatesImpl类中的getTransletInstance方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/dafa5052e153c29eb5d22bb0ff4c69f5.png)

其中455行调用_class[_transletIndex]的newInstance( )方法来实例化对象的操作

我们看一下_class[_transletIndex]是如何获取的，是否可以控制_class与_transletIndex值皆由451行处defineTransletClasses()方法中获取

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/3ee4112a8a2ea2b7000c82d287fb3201.png)

我们跟入defineTransletClasses()方法中一探究竟

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/62b59f97a0c97819aabac6c2ac1de16a.png)

在defineTransletClasses()方法中，首先在393行判断_bytecodes值是否为空

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/42e45309e4d50cc3bb655dab8a23df91.png)

值得注意的是，_bytecodes变量是TemplatesImpl类的成员变量

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5254995c16eeb34452e0a82cbac85b46.png)

因此_bytecodes变量可以在构造json字符串时传入，在构造poc时属于可控变量 _bytecodes变量非空值时，程序将会继续执行至下图红框处

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/6bbe808584d5a8e5d3c7b24d41400b7e.png)


此时，需要满足_tfactory变量不为null，否则导致程序异常退出。这就是为什么公开的poc中需要设置设置_tfactory为{}的原因。因为_tfactory为私有变量，且无setter方法，这里需要指定Feature.SupportNonPublicField参数来为_tfactory赋值

接下来，程序将会把_bytecodes变量中的值循环取出并通过loader.defineClass处理后赋值给_class[i]

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5fae284f08e0da8a0517fa9f43990c80.png)

我们首先来看下loader.defineClass方法是什么

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/ec061c3b3c86c1b3a02482df692a8eea.png)

可见，loader.defineClass方法其实就是对ClassLoader.defineClass的重写。defineClass方法可以从传入的字节码转化为Class

回头分析下上述流程

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5fae284f08e0da8a0517fa9f43990c80.png)

\_bytecodes变量非空值时，程序将会把_bytecodes数组中的值循环取出，使用loader.defineClass方法从字节码转化为Class对象，随后后赋值给_class[i]。如果此时的class为main class，_transletIndex变量值则会是此时_bytecodes数组中的下标值.因此当我们构造出_bytecodes:[evilCode]这样的json字符串（evilCode字符串为我们构造的恶意类的字节码）后，程序会将evilCode化为Class对象后赋值给_class[0]

现在回到getTransletInstance()方法中

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/7485cd6227bab22112407edb3fc801c2.png)

此时的_class[_transletIndex]即为我们构造传入的evilCode类.程序通过调用evilCode类的newInstance()方法来实例化对象的操作，这将导致我们构造的evilCode类中的恶意代码被执行.但在此之前，需要在poc构造json字符串时使得成员变量_name不为空，否则程序还未执行到将evilCode类实例化就提前return

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/36340dd97c18b7074c08d30fd9fce4b7.png)

注意：由于私有变量_name没有setter方法，在反序列化时想给这个变量赋值则需要使用Feature.SupportNonPublicField参数。

在分析完存在漏洞的getTransletInstance方法，我们需要找到一条调用链，这条调用链需要在使用fastjson处理json字符串时成功串连到存在漏洞的getTransletInstance方法上。我们继续向上跟踪代码

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/a99fa86415c1e44425807b808c4feff6.png)

com/sun/org/apache/xalan/internal/xsltc/trax/TemplatesImpl.java中newTransformer()方法中调用了getTransletInstance()。继续向上跟踪

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/873e4c395da9922f4755f03fdb6142e5.png)

com/sun/org/apache/xalan/internal/xsltc/trax/TemplatesImpl.java getOutputProperties()方法中调用了newTransformer()

getOutputProperties()方法为_outputProperties成员变量的getter方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/26c8c8cf214c6def1efa536683527acf.png)

细心的读者可能会发现，成员变量_outputProperties与其getter方法getOutputProperties()方法名字并不完全一致，多了一个下划线，fastjson是如何将其对应的呢？实际上，fastjson在解析的时候调用了一个smartMatch() 方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/6864c0cd6b84a6dbcf73d21ba3803c9c.png)

在寻找_outputProperties的getter方法时，程序将下划线置空，从而产生了成员变量_outputProperties与getter方法getOutputProperties()对应的形式

FastJson与TemplatesImpl的有趣结合
---------------------------------

首先说TemplatesImpl类。经过上文分析可发现：TemplatesImpl中存在一个反序列化利用链，在反序列化过程中，如果该类的getOutputProperties()方法被调用，即可成功触发代码执行漏洞。

再来分析下FastJson：经过上文对FastJson三种不同途径处理JSON字符串时关于getter方法被调用的条件来看，TemplatesImpl类_outputProperties成员变量的getter方法满足被调用条件。无论通过fastjson哪种方式解析json字符串，都会触发getOutputProperties()方法。

二者放在一起一拍即合：FastJson在反序列化TemplatesImpl类时会恰好触发TemplatesImpl类的getOutputProperties()方法；TemplatesImpl类的getOutputProperties()方法被触发就会引起反序列化代码执行漏洞。所以说这个漏洞利用很是巧妙。

总结
----

针对Fastjson 1.2.24反序列化漏洞的利用方式有很多，本文由于篇幅有限仅对比较巧妙的TemplatesImpl攻击调用链路进行举例。后续将会对Fastjson历史漏洞进行详细的分析，希望大家喜欢。