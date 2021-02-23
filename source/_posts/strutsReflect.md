---
title: Struts2从请求到Action——反射机制研究
date: 2020-01-07 15:39:03
tags: [web漏洞分析 ,java]
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/看见到洞见之楔子.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

本文不是对Struts2漏洞进行分析，而是对Struts2框架机制的一些简单的理解。这将有助于对Struts2漏洞进行深入的理解。

<!--more-->

正文
----

Struts2历史上出现过大大小小几十个漏洞。在分析漏洞的时候，除了需要理解漏洞是如何触发的，我对Struts2框架的原理比较好奇。众所周知，Struts2是通过配置struts.xml来定义请求和处理该请求的Action之间的对应关系等等。

Struts.xml类似下图这样的形式

![7a745298d3d0178fcf6aafb0c8fbc817.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107150944-ae5a3948-311c-1.png)

其中一个问题就是，Struts2是如何将请求和处理action通过struts.xml关联起来的？

其中的过程比较有意思，本文将简单针对这个机制的分析一下

Struts2官网给出的执行流程图如下

![edeb6b0a750daef4e0a968e14f6e2807.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151003-b994e0ba-311c-1.png)

在上图红框处，可见ActionInvocation模块，这一模块将调用拦截器并执行开发者编写的Action。ActionInvocation模块正是解答我们问题的关键之处，后文将从这里开始分析。

在分析流程之前，首先要说明一下：在Struts2框架中，程序将请求和处理action通过struts.xml关联起来的过程是基于java的反射机制实现的。

Java反射机制
------------

关于java反射，官方给出的解释如下

Reflection enables Java code to discover information about the fields, methods
and constructors of loaded classes, and to use reflected fields, methods, and
constructors to operate on their underlying counterparts, within security
restrictions.  
The API accommodates applications that need access to either the public members
of a target object (based on its runtime class) or the members declared by a
given class. It also allows programs to suppress default reflective access
control.

百度词条给出的解释如下

JAVA反射机制是在运行状态中，对于任意一个实体类，都能够知道这个类的所有属性和方法；对于任意一个对象，都能够调用它的任意方法和属性；这种动态获取信息以及动态调用对象方法的功能称为java语言的反射机制。

针对于反射机制，我的理解是：通常情况下，我们在编译前需要确定类型并创建对象；但反射机制使得我们可以在运行时动态地创建对象并调用其属性，即使此时的对象类型在编译期是没有被确定的。

关于反射简单的使用，可以见一下代码

以下代码改编自<http://tengj.top/2016/04/28/javareflect/>

大家可以看看这个文章，写的非常详细，我节选了其中一个简单的案例进行简单的介绍

ReflectDemo.java

![d4ad6409be4ceee62a69c731f3778788.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151015-c0e085c2-311c-1.png)

Person类

![a841d0ce7541078e003c64818a90db4a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151022-c4e506e8-311c-1.png)

接下来我们详细的分析下：

首先看下图红框处这一行

![2c55b98575b6dddaa8729daa6b8fde20.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151029-c99e30d8-311c-1.png)

这里使用了Class.forName("com.grq.reflect.Person")
生成了一个名为c的Person类的Class。这里的c为Class类型，Class.forName
方法的作用就是初始化给定的类

生成Person类的Class大致有三种方法，除了demo中给出的，还有如下两种，见下图

![0d298df35d8bfe6c2abb46bbe55bac9f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151043-d1c8923a-311c-1.png)

分别是通过获取类的静态成员变量class与通过对象的getClass()方法获取Class

回到正文，接下来看下图红框处这一行

![b44769116bbaedd23b2c53cdc6978593.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151052-d6c5544e-311c-1.png)

newInstance方法可以初始化生成一个实例。newInstance方法最终调用public无参构造函数。如果类没有public无参数的构造函数就会报错了。如果我们把Person类中的public无参数构造方法删除，就会出现对应下图的报错

![6744b9ce5559b604b226564358d675c6.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151100-dc1c69a0-311c-1.png)

newInstance()方法与new关键字类似但却不同：newInstance()使用的是类加载机制，而new关键字是创建一个新对象

接下来看下图红框处这一行

![6962a7052fde7cbc3b18bf27d4b21f71.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151109-e171763e-311c-1.png)

getMethod方法可以得到该类不包括父类的所有的方法，通过传入参数确定具体要获得的方法。这里通过c.getMethod("fun",String.class, int.class)获得Person类的fun方法

接下来看下图红框处这一行

![7a376a707b6755f1156b535643d3b8f4.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151118-e6627daa-311c-1.png)

invoke的作用是执行方法，如果这个方法是一个普通方法，那么第一个参数是类对象,如果这个方法是一个静态方法，那么第一个参数是类。后面的参数为将要传递的参数值

执行结果如下

![31ad77d7773a070cd0757bd4e1ae48a5.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151128-ec6bf6d6-311c-1.png)

到此，简单的Java反射机制介绍结束。

### 一种不同的写法

![3e025137eb06925d78af77371bbecdeb.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151138-f2b01e8c-311c-1.png)

在上图中，我们使用o.getClass()代替c，最终的结果如下图

![0abe72def9e4b294cdc147d7007b49d7.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151153-fba00476-311c-1.png)

可见o.getClass与c的Class对象所表示的实体名称是一致的，都是com.grq.reflect.Person。为什么要举这个例子呢？，因为Struts2里就是采用o.getClass这种形式进行反射的。

Struts2反射机制
---------------

首先我们用S2-001的Deme进行举例

![7d91ec6535988f2edd189c7207305c0d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151206-0359e434-311d-1.png)

当http://localhost:8080/s2_t_war_exploded/login.action
请求发送到后台时，让我们来看一下struts2是如何利用反射机制寻找到对应的LoginAction类进行处理

跟入后台com/opensymphony/xwork2/DefaultActionInvocation.java文件

程序调用invokeAction方法寻找用来处理请求的action类与对应的方法

![3d16b7c6b7d4daec699fdefe85b9c734.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151235-14bcbc88-311d-1.png)

在invokeAction方法中的404行处，见上图，程序最终通过invoke执行对应action类对象(上图红框处action)的对应方法(上图红框处method)

我们接下来分析下action类对象以及对应方法的生成过程

### 类对象的生成

首先我们来分析下下图中红框处的类对象是怎么获得的

![54c598ae0df1ee0c457c190aff11eb9a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151243-1945e7d4-311d-1.png)

invokeAction方法见下图

![c98ad56cf48b5503128856bc55a4433f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151251-1db5c384-311d-1.png)

Invoke中传入的Object类型的action参数其实是在invokeAction被调用时传递进来的

接着我们来看一下invokeAction被调用时的情况，见下图

![cb333de473a98d0e3fadfb776b480d33.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151258-21fc5872-311d-1.png)

从上图可见，action参数是通过getAction方法获得

跟入getAction方法

![7dd8c940303541080e8d767c38105dee.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151308-28102e6e-311d-1.png)

getAction方法直接将action返回

接着看下这个action是如何生成的，见下图

![06895aa95cc394121d527a90da29ed13.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151323-30c40c56-311d-1.png)

从上图可见，action其实是由buildAction方法生成

接着来跟一下buildAction方法，见下图

![48b46e2180c5d6db6405ee2b0ff41045.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151332-368f0d20-311d-1.png)

buildAction方法的作用是通过读取struts.xml中的配置，构建操作类的实例以处理特定请求（例如，Web请求）并最终返回一个用来处理web请求的action类的实例。从上图可见，buildAction方法会调用buildBean方法以返回用来处理web请求的action类的实例

我们跟入buildBean方法中，看一下传入的config.getClassName()是什么，具体见下图

![62369956c2b679acc8560be6686fbe45.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151340-3b6c622a-311d-1.png)

buildBean方法的作用是构建给定类型的通用Java object。这里的传入buildBean方法的className是一个String类型的字符串，值为com.demo.action.LoginAction，这是根据我们struts.xml中的配置得来见下图

![05a227b38e238c07a5e0b1b4c67a31cc.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151349-409c45ee-311d-1.png)

在struts.xml中，配置了Name为login的请求对应class为com.demo.action.LoginAction

回到createAction方法中，此时类对象的生成过程已经明确了，最终invoke方法中的action参数其实是Object类型的LoginAction类的实例

### method的生成

接着我们来分析下下图中红框处的method是如何获得的

![0a81230905512b16cdedc98c7efd35ec.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151359-46849114-311d-1.png)

method是在invokeAction中392行处这里生成，见下图红框处

![179799d70af0f7d7338380d993abd40d.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151412-4e8d59c2-311d-1.png)

首先看下getAction方法，这个方法在上文类对象生成一节已经分析过了，针对被例来说，该方法返回了一个Object类型的LoginAction类的实例。

接着，通过getClass方法由LoginAction类的实例获取LoginAction类的class对象，这里可以参考上文java反射一章中最后的那个例子。

最后通过getMethod方法，传入methodName(默认execute)，获取LoginAction类的execute方法

### invoke执行

上文已经将method与action分析完毕。最终程序将调用invoke执行LoginAction类的execute方法来处理请求

![166379e4abc2b4baa643e37ed64064ce.png](https://xzfile.aliyuncs.com/media/upload/picture/20200107151425-55b78650-311d-1.png)

参考链接
--------

http://tengj.top/2016/04/28/javareflect/