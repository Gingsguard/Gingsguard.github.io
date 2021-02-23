---
title: Python中有潜在代码执行风险的函数(一)
date: 2019-12-10 17:34:16
tags: web漏洞分析
categorise: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/timg.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

在Python中一些函数存在着任意代码执行的隐患，错误的使用这些方法将会导致漏洞的产生，攻击者可能会利用这些安全隐患进行攻击。

文中的知识点并非新知识，但我会围绕着基础点比较细致的分析漏洞的成因、防范以及绕过，希望对大家有帮助

<!--more-->

# **第一组**

首先介绍下python中常见的存在任意代码执行隐患的方法：eval与exec

简介
----

在python中，eval和exec的用法极其相似。eval和exec都可以将传入的字符串执行，但两者又有不同之处：

### eval

eval是一个python内置函数，语法为eval(*expression*, *globals=None*,*locals=None*)

eval函数接收三个参数：其中 expression
参数是用做运算的字符串类型表达式；globals参数用于指定运行时的全局命名空间；Locals参数用于指定运行时的局部命名空间。globals与 locals 是可选参数，默认值是 None，他们只在运算时起作用，运算后则销毁。

### exec

在Python2中exec是一个内置语句(statement)而不是一个函数，但是到了Python3中exec将Python2中作为内置语句的exec和execfile()函数功能整合到一起，成为了一个新的函数，语法为exec(*object*[, *globals*[,*locals*]])

exec的第一个参数可以是code object，因此它可以执行复杂的代码逻辑，例如变量赋值操作等，这一点是eval做不到的。但exec返回值永远为 None，因此exec不能像eval一样将计算结果返回。exec的后两个参数与eval一致

关于二者的区别，可以见下面的几组代码

1、eval与exec在执行 python语句上的不同

![7e44ff01dfa10acb22e6ab4528e9c2c9.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181145-a4607d6a-1747-1.png)

Exec可以对变量a进行赋值操作

![f799978a115968705906172096fa177f.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181155-aa0a6096-1747-1.png)

Eval并不能对变量a进行赋值

![6c0efaabd67276a72f5705b1f887ecec.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181201-ae135dd2-1747-1.png)

Exec可以执行python语句”import os”

![2717a5d529969f76d2451dbe47c2feaf.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181212-b47e45a6-1747-1.png)

eval不能直接执行python语句”import os”；eval可以执行表达式"__import__('os')"并返回计算结果

2、eval与exec在返回值上的不同

![30524f3b1b371deaaab14bc93f07a16f.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181219-b8b8a490-1747-1.png)

eval在对表达式进行计算后，返回计算结果

![95efb3985c4719306cb4101924a93ecc.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181226-bca73a30-1747-1.png)

exec并无返回结果

虽然eval与exec存在着种种区别，但是他们都会将传入的第一个参数执行，这将有着潜在的任意代码执行隐患

存在的安全隐患
--------------

在使用eval和exec时存在的安全隐患是极其相似的，因此下文代码中使用eval进行举例

下图的代码addition方法使用eval对传入参数进行处理

![4081f6061d9b86bd7205c2e80887c016.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181232-c067b0d2-1747-1.png)

Addition方法会将传入的a与b参数拼接"a+b"字符串并通过eval计算

当a传入的参数为"__import__('os').system('whoami')"时,如下图：

![236478d04c99c592ec3da204a012de7b.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181241-c574aa76-1747-1.png)

Eval执行的表达式为"__import__('os').system('whoami')+2"

这将执行系统命令”whoami”并最终返回2

这里有一个细节，为什么eval计算结果为2呢？

因为__import__('os').system('whoami')结果为0，如下图

![038dc616d726193296e1173c489ee72b.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181250-caca17c2-1747-1.png)

因此eval最终计算的表达式为"0+2"

当然，在实际情况中，可以使用”\#”将后续内容进行注释，通过传入"__import__('os').system('whoami')#"

![8b9f3ca5c6cc74886553832c4c125348.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181304-d39359a4-1747-1.png)

最终eval需要执行的表达式为”__import__('os').system('whoami') # +2”

由于最终相当于执行了"0 #+2"，所以返回值为0

防范
----

从上述案例中可以发现，在通常情况下，只要传递给eval/exec中的变量可控，就存在执行系统命令的问题

针对以上例子 eval("__import__('os').system('whoami')")问题时，存在一种常见的限制方法：即指定 eval 的globals参数为 {'__builtins__': None} 或者 {'__builtins__': {}}这样的形式

上文只是简单的介绍了eval/exec中globals这个参数，接下来详细说明下为什么将eval
/exec中globals参数设置为 {'__builtins__': None} 或者 {'__builtins__': {}}这样的形式就可以避免任意代码执行的隐患

在eval 与exec中，globals参数用于指定运行时的全局命名空间，如果globals没有被提供，则使用python的全局命名空间。

举个简单的例子如下：

当globals参数没有被提供时，如下图：

![0cc2c1200cb544e417357d5c823b768e.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181314-d94c1ebc-1747-1.png)

当globals参数没有被提供时，eval使用python的全局命名空间。这里的a为1，eval结果为2

![8a7ab13c53c4a723eedcfd3e632cbda6.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181323-de82e32a-1747-1.png)

当globals参数被提供即globals为{‘a’:2}时，这时候eval的作用域就是{‘a’:2}字典所指定，这里的a为1，eval结果为2

当globals被指定时，eval只使用globals参数所提供的字典里的数据，并不使用模块中的全局命名空间，见下图

![e4596dc67fef58c13bbe166b4338ea89.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181334-e54623f2-1747-1.png)

即使我们定义了模块全局命名空间中b变量为2，但在由于eval使用globals参数指定全局命名空间为{'a':2}里没有声明变量b，因此程序报出”name 'b' is not defined”的错误

接下来要介绍一下__builtins__模块

__builtins__模块提供对Python的所有“内建”标识符的直接访问的功能。Python解释器在启动的时候会首先加载内建名称空间并自动导入所对应的内建函数。

由于__builtins__的存在，使得在Python可以直接使用一些内建函数而不用显式的导入它们，例如input()、list()、__import__ 等

加载__builtins__自动导入的内建函数列表如下

![3a0241441ac0df719001167c9e8dbc44.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181342-ea00139e-1747-1.png)

我们可以在python中直接使用上图中的这些内建函数而不需要导入

回到eval/exec问题中：值得注意的是，在eval/exec中，如果globals参数被提供，但是没有提供自定义的__builtins__，那么eval/exec会将当前环境中的__builtins__拷贝到自己提供的globals里，例子见下图：

![ce4db27358b781ed836c3cb95f034f23.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181349-ee3222cc-1747-1.png)

由于没有自定义__builtins__，因此使用当前环境中的__builtins__，而当前环境中的__builtins__的函数列表中存在__import__，因此可以直接使用__import__

但是如果globals参数中使用了自定义的__builtins__，eval/exec则使用globals所指定的__builtins__，例如下图

![d34277f880e9e284d7c0c5ba45e786a6.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181355-f1efd116-1747-1.png)

上图指定globals为{'__builtins__':{'list':list}}，因此在此eval中可以使用list内置函数，但是由于没有指定__import__,所以使用__import__时报错

exec同样如此，如下图

![b527316cebd6de05393fc85535b3dd2a.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181403-f69bdbf6-1747-1.png)

指定globals为{'__builtins__':{'list':list}}，使用__import__时报错

因此可以通过指定globals参数，来控制eval运行执行的内置函数。这个方法看起来很有效的限制eval/exec对__import__等内置函数的使用，似乎可以防止任意代码执行。但是此方法仍然存在绕过

### 绕过

在上述防范中，通过globals参数对__builtins__中的内置函数范围进行限制，使得eval/exec无法随意使用”__import__”等内置函数来达成阻止任意代码执行

但是却存在着如下的绕过：

(1,2).__class__.__bases__[0].__subclasses__()

这里解释一下上面这串代码的含义

"(1,2)"是一个元组

![2b2dd82e7180a13bcbc9d82da46e0a76.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181411-fb144b46-1747-1.png)

__class__ 是用来查看对象所在的类

![e4b512c988eb91e3804e9be83916b2fb.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181421-0145fd20-1748-1.png)

很显然”(1,2)”元组对象所对应的类是tuple

__bases__属性返回所有直接父类所组成的元组。

![de3600eaf834593b3910830b1df1badb.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181429-05d7350c-1748-1.png)

如上图可见tuple类的直接父类是object类

__subclasses__用来获取类的所有子类

![5bf3c3b432f1a16189bde5be6bede9a1.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181437-0aad9d28-1748-1.png)

因为(1,2).__class__.__bases__[0]已经是object类了，而object类子类众多，因此可以使用的类就比较丰富了

举个例子，如下图

![df7c89e9eab331f5b72463e22df45617.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181444-0f12e224-1748-1.png)

上图红框中，也就是(1,2).__class__.__bases__[0].__subclasses__()[7],对应的类是list

因此可以通过(1,2).__class__.__bases__[0].__subclasses__()[7]来使用list对数据进行处理，如下图

![bb3656751aa7f58d74f8e7e2c5d2e2aa.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181452-13a7cae8-1748-1.png)

如上图所示，通(1,2).__class__.__bases__\[0\].__subclasses__()\[7\]((1,2))将元组(1,2)转换成数组\[1,2\]

在明白了原理之后可以发现，除了使用(1,2).__class__.__bases__\[0\].__subclasses__()\[7\]((1,2))之外，还可以使用().__class__.__bases__\[0\].__subclasses__()\[7\]((1,2))或\[\].__class__.__bases__\[0\].__subclasses__()\[7\]((1,2))或"".__class__.__bases__\[0\].__bases__\[0\].__subclasses__()\[7\]((1,2))等等

在上例中，由于str类的直接父类是basestring，basestring的直接父类才是object，而因此上述例子中需要使用"".__class__.__bases__\[0\].__bases__\[0\].__subclasses__()\[7\]((1,2))

但构造利用链的核心方法就是：只要追溯到object类并使用__subclasses__()使用object类的子类即可

我们查看下object的子类，找一找有没有能执行系统命令的

![566beed21499be9fc25452623809ebf6.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181506-1c0ac118-1748-1.png)

上图红框里有一个subprocess.Popen，很显然，我们可以通过这个来执行系统命令

利用链如下

().__class__.__bases__\[0\].__subclasses__()\[176\](“whoami”)

这里的176是subprocess.Popen在object子类列表中的下标值

实际效果如下图

![0440151554898a7d57d225400a6a4b1a.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181513-2044eb1e-1748-1.png)

可见,虽然限制只允许使用list,但是我们仍然可以执行系统命令

因此，简单的使用{'__builtins__': None}是无法满足eval的安全需求的

实际上，可以使用ast.literal_eval()来代替eval()

ast.literal_eval()允许传入的内容如下

strings, bytes, numbers, tuples, lists, dicts, sets, booleans, None

当不合法的字符传入时，程序则会报错，如下图

![e8535ef76cfce3409f43cecc8bea9876.png](https://xzfile.aliyuncs.com/media/upload/picture/20191205181521-253fbda6-1748-1.png)

使用ast.literal_eval()代替eval和exec，可以有效的防止任意代码执行漏洞

# 写在最后

由于篇幅有限，这里先介绍第一组，后续文章会介绍其他有潜在安全隐患的函数。