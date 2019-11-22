---
title: WordPress-WooCommerce 3.6.4 从CSRF 到 RCE
date: 2019-10-16 14:49:36
tags: web漏洞分析
categories: 技术
---

![KFCN4I.png](https://s2.ax1x.com/2019/10/16/KFCN4I.png)

WooCommerce是WordPress最受欢迎的电子商务插件，安装量超过500万。

WooCommerce处理产品导入方式的缺陷导致存储型XSS漏洞的产生，可以通过跨站点请求伪造（CSRF）来利用该漏洞。由于wordpress后台存在插件编辑等功能，通过xss漏洞，可以写入php代码

<!--more-->

# 漏洞简介

WooCommerce是WordPress最受欢迎的电子商务插件，安装量超过500万。

WooCommerce处理产品导入方式的缺陷导致存储型XSS漏洞的产生，可以通过跨站点请求伪造（CSRF）来利用该漏洞。由于wordpress后台存在插件编辑等功能，通过xss漏洞，可以写入php代码

 

漏洞成因简单来说，是因为WooCommerce存在csv文件导入功能，该功能可以将csv中内容导入到产品列表中

导入时共分四步(上传、列映射、导入以及done)，这四个步骤的请求是独立的，可以单独发送对应的请求，在后台完成相应的功能。

WooCommerce只在第一步(上传csv文件)的时候验证了csrf token，而后续步骤并没有进行csrf防护。由于一定权限的wordpress用户可以直接在wordpress媒体库中上传csv文件，这将替代了有csrf防护的第一步，进而通过CSRF漏洞衔接后三步，导致了本次漏洞的产生。

 

在这篇文章中，我将会为大家分析WooCommerce插件后台代码，分析本次漏洞成因，并还原本次漏洞利用，介绍POC的构造以及一些wordpress机制。

 

## WooCommerce导入功能介绍

WooCommerce可以通过csv文件导入产品

![KiozkQ.png](https://s2.ax1x.com/2019/10/16/KiozkQ.png)

 

导入之后如下图所示

![Kioj0S.png](https://s2.ax1x.com/2019/10/16/Kioj0S.png)

WooCommerce中的每个产品都有一个产品说明，商店经理可以在其中插入有限的HTML，即非常基本的HTML标签和属性，例如`<a>`与`href`属性结合的标签。

 

导入过程分为四步：上传、列映射、导入以及done！

 

每一步对应的request分别如下

上传：

![KiovTg.png](https://s2.ax1x.com/2019/10/16/KiovTg.png)

![KiTV7F.png](https://s2.ax1x.com/2019/10/16/KiTV7F.png)

 

列映射

![KioXm8.png](https://s2.ax1x.com/2019/10/16/KioXm8.png)![KiTSYj.png](https://s2.ax1x.com/2019/10/16/KiTSYj.png)

![KiTpfs.png](https://s2.ax1x.com/2019/10/16/KiTpfs.png)

 

导入

![KiTCpn.png](https://s2.ax1x.com/2019/10/16/KiTCpn.png)

![KiTPlq.png](https://s2.ax1x.com/2019/10/16/KiTPlq.png)

值得一提的是，导入步骤以及后续Done步骤的请求，是第三步列映射(mapping)请求完成后，通过使用admin-ajax.php 实现wordpress的ajax请求来完成的。后续步骤并不需要用户操作。在列映射步骤中，点击运行导入器按钮后，用户只需等待导入完成即可，程序将通过ajax向后台自动发送该导入等请求。

# 漏洞分析

## WooCommerce导入功能代码逻辑分析

我们先来看下，WooCommerce导入功能是怎么运作的

跟入后台代码，看看程序是如何处理导入的四个步骤的

当每个步骤请求发起后，后台都会使用dispatch来处理

![KiTi60.png](https://s2.ax1x.com/2019/10/16/KiTi60.png)

这里简单解释下，首先可见上图中call_user_func执行$this->steps中的值，$this->steps值如下图，是固定的

![KiTFXV.png](https://s2.ax1x.com/2019/10/16/KiTFXV.png)

$this->steps对应了四步操作。

当每一步操作请求发送到后台时，都会调用dispatch方法，从$this->step对应的‘upload’/’mapping’/’import’/’done’这些数组中寻找对应的方法执行，

 

![KiTAmT.png](https://s2.ax1x.com/2019/10/16/KiTAmT.png)

如上图，当$_POST['save_step']以及$this->steps[ $this->step ]['handler']非空的情况下，执行

```php
call_user_func( $this->steps[ $this->step ]['handler'], $this );
```

 

否则，执行

```php
call_user_func( $this->steps[ $this->step ]['view'], $this );
```

 

反观四个上文四个步骤的请求，满足$_POST['save_step']存在的，只有第一步upload

![KiTE0U.png](https://s2.ax1x.com/2019/10/16/KiTE0U.png)

Upload请求发起时，执行

call_user_func( $this->steps[ $this->step ]['handler'], $this );

我们在数组中查找$this->steps[ $this->step ]['handler']的值，看看此时要执行什么方法，如下图

![KiTek4.png](https://s2.ax1x.com/2019/10/16/KiTek4.png)

从上图可见，此时的$this->steps[ $this->step ]['handler']的值是upload_form_handler，upload_form_handler方法将被执行

 

跟入upload_form_handler方法，如下图

![KiTmtJ.png](https://s2.ax1x.com/2019/10/16/KiTmtJ.png)

可见上图288行存在check_admin_referer方法

跟入check_admin_referer方法，如下图

![KiTnh9.png](https://s2.ax1x.com/2019/10/16/KiTnh9.png)

如上图，此时1101行需要检验$REQUEST[$query_arg]的值，该值即为请求中的_wpnonce值

![KiTKpR.png](https://s2.ax1x.com/2019/10/16/KiTKpR.png)

这个nonce值是生成在页面中的，我们没法获取。可见，有了这个nonce的限制，在upload即上传文件的这一步，我们没法采用csrf攻击

 

但是除此之外的其他步骤，并不会触发这个方法，其他步骤执行的都是

call_user_func( $this->steps[ $this->step ]['view'], $this );

$this->steps[ $this->step ]['view']中的方法，并没有检查nonce

在WooCommerce插件的导入模块中，只在upload这一步，加入了nonce，进行了csrf防御。也就是说，其他步骤并没有对csrf进行防御

 

既然我们没有办法进行csrf攻击，来上传恶意csv，那是否还有其他办法上传呢？

其实，这个恶意的csv并不需要管理员来上传，拥有作者权限的用户，可以自行上传csv文件到wordpress目录

![KiTM11.png](https://s2.ax1x.com/2019/10/16/KiTM11.png)

直接在媒体里上传就行了

但是这个csv，是需要管理员权限，才能导入到woocommerce的产品中

 

## 漏洞利用思路

通过上文我们对导入功能代码的分析可以发现，该插件对csv文件的上传(upload)步骤，做了csrf防护，但是随后三个步骤，并没有进行csrf防护。虽然我们没法对上传步骤发起csrf攻击，但是我们可以绕过上传步骤，直接攻击后续步骤

Wordpress对作者权限的用户，开放上传媒体文件的权限，如下图

![KiTQ6x.png](https://s2.ax1x.com/2019/10/16/KiTQ6x.png)

我们可以利用这个功能，替换有csrf保护的upload步骤

此时的思路是：

1、 使用有作者权限的用户在媒体库上传一个恶意的csv文件

2、 构造csrf，诱骗管理员执行发起导入产品请求，将我们上传的csv导入woocommerce的产品中

3、导入成功，产品中被插入xss

4、管理员访问产品页面，xss执行

接下来验证我们的思路

### 上传一个恶意的csv文件

首先，我们构造了一个csv

![KiTlX6.png](https://s2.ax1x.com/2019/10/16/KiTlX6.png)

接着，我们用作者权限的用户上传媒体库

![KiT3nK.png](https://s2.ax1x.com/2019/10/16/KiT3nK.png)

最后，记录上传好的地址

wp-content/uploads/2019/10/products-6.csv

上传部分完成

 

### 构造csrf诱使管理员导入

我们先来看下正常情况下，导入csv的过程的请求

![KiT80O.png](https://s2.ax1x.com/2019/10/16/KiT80O.png)

 

Head

![KiTG7D.png](https://s2.ax1x.com/2019/10/16/KiTG7D.png)

Body

![KiTYAe.png](https://s2.ax1x.com/2019/10/16/KiTYAe.png)

可以发现，在body中存在一个security参数

在后台程序校验上传请求是否合法时，会对post body中该参数进行校验，如下图

![KiTttH.png](https://s2.ax1x.com/2019/10/16/KiTttH.png)

问题又来了，虽然导入请求没有csrf token的保护，但是如果我们想直接构造一个上图的导入表单，通过来诱骗管理员访问并提交如上请求来导入恶意csv，就需要知道这个security参数值。

这个security参数是如何生成的？我们是否可以伪造这个参数？或者，既然这是一个ajax请求，我们能否绕开这个security?

 

#### security参数值分析

这个参数是由上一个step(mapping列映射)的请求生成的

![KiTNhd.png](https://s2.ax1x.com/2019/10/16/KiTNhd.png)

Head

![KiTa9A.png](https://s2.ax1x.com/2019/10/16/KiTa9A.png)

 

Body

![KiTd1I.png](https://s2.ax1x.com/2019/10/16/KiTd1I.png)

当这个请求执行后，在相应的body中，会包含我们所需要的security参数值

![KiTwct.png](https://s2.ax1x.com/2019/10/16/KiTwct.png)

注意看上图红框处的import_nonce值，与我们上文中的security参数值是一样的

#### Security算法分析

跟踪后台代码，分析下这个import_nonce/Security值是如何计算出来的

![KiT0jP.png](https://s2.ax1x.com/2019/10/16/KiT0jP.png)

Import_nonce的产生如上图所示，是通过wp_create_nonce方法计算而来

跟入wp_create_nonce方法

![KiTDnf.png](https://s2.ax1x.com/2019/10/16/KiTDnf.png)

可见最终计算Import_nonce值，需要使用$i，$action，$uid，$token四个变量

 

变量$i由wp_nonce_tick方法生成，跟入wp_nonce_tick方法看一下

![KiTrB8.png](https://s2.ax1x.com/2019/10/16/KiTrB8.png)

可见这个是用来计算nonce失效时间的，上图中的$nonce_life默认都是86400,也就是一天的总秒数，而上图2053行最终计算表达式不难看出，只要是半天内($nonce_life/2)生成的, wp_nonce_tick方法返回的这个值都应该是一样的。也就是说，Import_nonce值的生存期是半天(43200s)

 

接下来几个参数就很简单了，$action是固定的'wc-product-import'，uid，token这些都是管理员的值

 

#### 我们是否需要关心security参数值？

但事实上，我们并不需要关心这个security参数值，甚至根本不用去构造import这一步的请求。

在Import这个步骤中，向后台发送的是ajax请求，这个请求并不是用户点击发送表单完成的，而是mapping步骤完成后，连带一同发起的。我们只需构造与发送mapping步骤的请求，程序将通过ajax自动完成后续import 以及Done步骤，因此，我们根本不需要关心Import步骤中的security值。

详细分析如下：

仍然看mapping列映射这一步的请求的后台代码，仍然分析下图这块代码 

![KiTsHS.png](https://s2.ax1x.com/2019/10/16/KiTsHS.png)

上文我们分析了这块代码的432行，也就是security值是如何计算出来的，但却没有介绍这块代码的实际作用

这里`wp_localize_script()`使用JavaScript变量的数据对注册的脚本进行本地化操作，接着在442行处使用wp_enqueue_script将JS脚本添加到WordPress程序生成的页面当中。如上图，`wc_product_import_params`变量中的所有数据都由攻击者控制，例如其中重要的file路径。

mapping列映射这个请求完成后的生成页面，将使用AJAX请求将攻击者控制的`$_POST`变量和有效的随机数一起发送到WordPress后端，完成导入步骤。

 

也就是说，我们只需构造mapping列映射这一步骤的表单，诱使管理员访问，在mapping列映射完成后的返回页面中，存在发起import步骤的js代码，当页面被浏览器加载时，使用AJAX请求将攻击者控制的`$_POST`变量和有效的随机数一起发送到WordPress后端，完成后续的导入步骤。

### 导入成功以及XSS触发

将构造好的mapping步骤表单链接诱使管理员点击，恶意csv被会被导入，此时查看产品列表，如下图

![KiT6Ag.png](https://s2.ax1x.com/2019/10/16/KiT6Ag.png)

这条恶意的产品信息已经存在于产品列表中

 

当打开产品页面时，其中的脚本就会被执行

![KiTcNQ.png](https://s2.ax1x.com/2019/10/16/KiTcNQ.png)

 

# 漏洞利用

根据上文我们分析，我们只需构造mapping列映射这一步骤的表单，诱使管理员访问，即可完成mapping列映射以及导入步骤。

 

最终payload如下

![KiTghj.png](https://s2.ax1x.com/2019/10/16/KiTghj.png)

这里的&file=../wp-content/uploads/2019/10/products-6.csv为之前步骤中，上传的恶意csv的路径，需要根据实际情况构造

Payload中form的两个input，map_from与map_to，是mapping列映射步骤后台必须存在的参数，参见下图代码

![KiTR9s.png](https://s2.ax1x.com/2019/10/16/KiTR9s.png)

需要注意的是，我们构造的js语句插入在csv中哪个字段，这里的map_from map_to就要写对应的字段名称，否则导入时会出错

 

管理员访问该payload，csrf漏洞将会被触发。表单被提交后，首先完成mapping步骤，接着，程序通过ajax自动发送import以及done步骤的请求，完成后续步骤。稍加等待，我们恶意的产品数据将会被导入，当管理员访问产品页面时，插入的js脚本将会被执行

 

# XSS to RCE

Wordpress中允许博客管理员编辑管理控制台中的主题和插件文件。通过滥用XSS漏洞，攻击者可以在远程服务器上执行任意PHP代码。

例如我们可以通过编辑插件功能，在后台写下payload

![KiTW3n.png](https://s2.ax1x.com/2019/10/16/KiTW3n.png)

编辑插件页面如上图

我们构造恶意csv如下图

![KiTfcq.png](https://s2.ax1x.com/2019/10/16/KiTfcq.png)

 

构造csrf表单如下图

![KiThj0.png](https://s2.ax1x.com/2019/10/16/KiThj0.png)

当管路员访问我们的csrf表单，恶意的csv将会被导入

当管理员访问该产品页面时，插入产品描述内容中的js脚本将会被执行，akismet.php中的内容将会被修改，从而达到的插入后门的作用，如下图

![KiT5uV.png](https://s2.ax1x.com/2019/10/16/KiT5uV.png)