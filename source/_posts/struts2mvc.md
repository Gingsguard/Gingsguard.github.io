---
title: Struts2 框架分析
date: 2019-9-20 14:25:46
tags: [web漏洞分析 ,java]
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/机器学习算法2.jpg
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

Struts2是一个基于MVC设计模式的Web应用框架，它本质上相当于一个servlet，在MVC设计模式中，Struts2作为控制器(Controller)来建立模型与视图的数据交互。

Struts2以WebWork为核心，采用拦截器的机制来处理用户的请求，这样的设计也使得业务逻辑控制器能够与ServletAPI完全脱离开

<!--more-->

首先我们来看下Struts2的架构图

![le2CrV.png](https://s2.ax1x.com/2019/12/28/le2CrV.png)

上图中的Key，介绍如下：

-   **Servlet Filters：过滤器链，客户端的所有请求都要经过Filter链的处理。**

-   **StrutsCore：Struts2的核心部分，但是Struts2已经帮我们做好了，我们不需要去做这个**

-   **Interceptors，Struts2的拦截器。Struts2提供了很多默认的拦截器，可以完成日常开发的绝大部分工作；而我们自定义的拦截器，用来实现实际的客户业务需要的功能。**

-   **UserCreated，由开发人员创建的，包括struts.xml、Action、Template，这些是每个使用Struts2来进行开发的人员都必须会的。**



上图中的各个元素，介绍如下

**FilterDispatcher/StrutsPrepareAndExecuteFilter**

FilterDispatcher**/**StrutsPrepareAndExecuteFilter是整个Struts2的核心过滤器，它将拦截请求并。在Struts的版本>= 2.1.3，推荐升级到新的Filter-StrutsPrepareAndExecuteFilte

![legf4H.png](https://s2.ax1x.com/2019/12/28/legf4H.png)



**ActionMapper**

FilterDispatcher/StrutsPrepareAndExecuteFilter将会调用ActionMapper处理请求过来的url，判断该请求是否需要struts2来进行处理，如果需要会返回一个包含了actionName,namespace等信息的ActionMapping对象

![legsjx.png](https://s2.ax1x.com/2019/12/28/legsjx.png)



**ActionProxy**

ActionProxy用来创建一个ActionInvocation代理实例，除此之外，ActionProxy还会调用ConfigurationManager去读取struts.xml的配置

![legovt.png](https://s2.ax1x.com/2019/12/28/legovt.png)



**ConfigurationManager**

ConfigurationManager用来读取struts.xml配置

![leg4Cd.png](https://s2.ax1x.com/2019/12/28/leg4Cd.png)

**struts.xml**

struts.xml是Stuts2的应用配置文件

![leg6u6.png](https://s2.ax1x.com/2019/12/28/leg6u6.png)



**ActionInvocation**

通过ActionMapper返回的actionName,namespace等信息调用拦截器并执行Action

![legx8s.png](https://s2.ax1x.com/2019/12/28/legx8s.png)



**Interceptor**

Interceptor是Struts2中的拦截器。在Action运行之前或者Result运行之后来进行执行。默认的Interceptor个数为20个

![le2FVU.png](https://s2.ax1x.com/2019/12/28/le2FVU.png)



**Action**

Action为开发人员编写的，用来处理请求以及封装数据的模块



Struts2执行流程跟踪
-------------------

首先我们在Struts2的调度中心——StrutsPrepareAndExecuteFilter中的doFilter方法中打个断点

![legRED.png](https://s2.ax1x.com/2019/12/28/legRED.png)

当Web容器收到请求（HttpServletRequest），在它将请求传递给ActionContextCleanUp、Other
filters(SiteMesh,etc)之后，容器将调用FilterDispatcher核心控制器。正如上图所示，程序将会执行到doFilter方法中。

在doFilter方法中，将会判断请求是否应该由struts2处理**，**下图红框中的代码就是用来进行这步操作

![legbb8.png](https://s2.ax1x.com/2019/12/28/legbb8.png)

不由struts2处理的请求，将会被doFilter放行，见上图127行

接着doFilter方法中将会调用ActionMapper处理请求，ActionMapper用来确定请求哪个Action并返回一个ActionMaping对象(mapping),mapping中封装了actionName和namespace等信息

![legz2n.png](https://s2.ax1x.com/2019/12/28/legz2n.png)

![le2A54.png](https://s2.ax1x.com/2019/12/28/le2A54.png)

mapping中封装了请求action的Name以及namespace等信息

当Mapping不为空时，FilterDispatcher将控制权委派给ActionProxy，下面一些列图片将展示控制权委派的过程

![legHDf.png](https://s2.ax1x.com/2019/12/28/legHDf.png)

当Mapping不为空时，执行executeAction方法，并传入ActionMaping对象(mapping)

继续跟入executeAction

![legX5Q.png](https://s2.ax1x.com/2019/12/28/legX5Q.png)

executeAction中调用serviceAction方法

继续跟入serviceAction

![legIgI.png](https://s2.ax1x.com/2019/12/28/legIgI.png)

从上图红框处可见，程序根据mapping中的信息创建创建一个名为proxy的ActionProxy对象

接着，执行proxy.execute()方法

![legcDK.png](https://s2.ax1x.com/2019/12/28/legcDK.png)

跟入execute方法，进入DefaultActionProxy

![leg58A.png](https://s2.ax1x.com/2019/12/28/leg58A.png)

接着进入DefaultActionInvocation

![le2Svq.png](https://s2.ax1x.com/2019/12/28/le2Svq.png)

在DefaultActionInvocation中，程序将会加载拦截器

加载的默认拦截器共20个，见下图

![leggHO.png](https://s2.ax1x.com/2019/12/28/leggHO.png)

当所有拦截器调用完毕，ActionInvocation调用Action

![legOUg.png](https://s2.ax1x.com/2019/12/28/legOUg.png)

最终，请求中对应的开发的人员编写的action将会被加载

![leg7KP.png](https://s2.ax1x.com/2019/12/28/leg7KP.png)

一旦执行结果返回结果字符串，ActionInvocation将查找结果字符串对应的(Result）然后调用对应的模版（JSP）来呈现页面。