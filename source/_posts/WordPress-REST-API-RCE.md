---
title: WordPress REST API 内容注入漏洞分析
date: 2017-09-10 15:11:17
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/WordPress-REST-API-内容注入漏洞分析.jpg)

WordPress是一种使用PHP语言开发的博客平台，用户可以在支持PHP和MySQL数据库的服务器上架设属于自己的网站。也可以把 WordPress当作一个内容管理系统来使用。<!--more-->

WordPress 在4.7.0版本之后将REST API插件集成到默认功能之中。REST API为WordPress的使用者提供了一个方便快捷的管理接口。在WordPress 4.7.0-4.7.1版本中,存在着一个越权漏洞，成功的利用这个漏洞，可以绕过管理员权限对文章进行增删改查操作。

## 影响版本

WordPress 4.7.0-4.7.1

## 漏洞分析

在正式的漏洞分析开始前，先来简单介绍下REST API的使用。官网给出的介绍如下

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/c095f00fa1cc64abde17d4bbeb44f5a1.png)

具体使用详情请参照REST API Handbook

https://developer.wordpress.org/rest-api/

在使用api对文章进行操作之前，需要对操作进行授权，授权方式有三种：cookie、oauth和简单认证。如果不进行授权直接通过api对文章进行修改操作，会返回一个401，如下图所示

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/c095f00fa1cc64abde17d4bbeb44f5a1.png)

如果想成功利用漏洞，必须绕过权限管理。我们跟踪下后台update处权限管理代码

<pre class="lang:default decode:true ">public function update_item_permissions_check( $request ) {

   $post = get_post( $request['id'] );
   $post_type = get_post_type_object( $this-&gt;post_type );

   if ( $post &amp;&amp; ! $this-&gt;check_update_permission( $post ) ) {
      return new WP_Error( 'rest_cannot_edit', __( 'Sorry, you are not allowed to edit this post.' ), array( 'status' =&gt; rest_authorization_required_code() ) );
   }

   if ( ! empty( $request['author'] ) &amp;&amp; get_current_user_id() !== $request['author'] &amp;&amp; ! current_user_can( $post_type-&gt;cap-&gt;edit_others_posts ) ) {
      return new WP_Error( 'rest_cannot_edit_others', __( 'Sorry, you are not allowed to update posts as this user.' ), array( 'status' =&gt; rest_authorization_required_code() ) );
   }

   if ( ! empty( $request['sticky'] ) &amp;&amp; ! current_user_can( $post_type-&gt;cap-&gt;edit_others_posts ) ) {
      return new WP_Error( 'rest_cannot_assign_sticky', __( 'Sorry, you are not allowed to make posts sticky.' ), array( 'status' =&gt; rest_authorization_required_code() ) );
   }

   if ( ! $this-&gt;check_assign_terms_permission( $request ) ) {
      return new WP_Error( 'rest_cannot_assign_term', __( 'Sorry, you are not allowed to assign the provided terms.' ), array( 'status' =&gt; rest_authorization_required_code() ) );
   }

   return true;
}
</pre>

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/614b6c67791a249dd43c54954278af11.png)

如上图所示，在这里if语句中，前半部分$post为真，后半部分check_update_permission()函数对$post的权限进行判断，结果为假，导致返回Sorry, you are not allowed to edit this post信息。

这个漏洞的挑战就在于，如何成功的绕过update_item_permissions_check()模块，使其最终return true。

我们回头看update_item_permissions_check()函数，

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/5b666100fc09a0a4a7e0f09447e0e807.png)

注意到$post = get_post( $request['id'] );这一行，这一行的作用是判断提交的文章id是否存在。

<pre class="lang:default decode:true ">function get_post( $post = null, $output = OBJECT, $filter = 'raw' ) {
   if ( empty( $post ) &amp;&amp; isset( $GLOBALS['post'] ) )
      $post = $GLOBALS['post'];

   if ( $post instanceof WP_Post ) {
      $_post = $post;
   } elseif ( is_object( $post ) ) {
      if ( empty( $post-&gt;filter ) ) {
         $_post = sanitize_post( $post, 'raw' );
         $_post = new WP_Post( $_post );
      } elseif ( 'raw' == $post-&gt;filter ) {
         $_post = new WP_Post( $post );
      } else {
         $_post = WP_Post::get_instance( $post-&gt;ID );
      }
   } else {
      $_post = WP_Post::get_instance( $post );
   }

   if ( ! $_post )
      return null;

   $_post = $_post-&gt;filter( $filter );

   if ( $output == ARRAY_A )
      return $_post-&gt;to_array();
   elseif ( $output == ARRAY_N )
      return array_values( $_post-&gt;to_array() );

   return $_post;
}
</pre>

可见，如果id对应的文章不存在，则返回null。

如果我们输入的url是这种形式

http://192.168.3.112/wordpress/index.php/wp-json/wp/v2/posts/1/?id=1grq

get_post()函数返回值一定为null，这样会使得$post值为null，回头来看update_item_permissions_check()函数，这时update_item_permissions_check()函数的返回值竟然为true了！

既然update_item_permissions_check()函数的返回值为true，说明我们绕过了update_item_permissions_check()权限验证，但是id为‘1grq’，根本不存在这样数字加字母组合的文章id，那怎么才能对指定文章进行越权操作呢？

有趣的事情发生了，让我们来看update_item()函数，这个函数是用来update通过权限验证的数据，我们看看它是怎么定义的

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/6f07e62c711ced1616ab49bf0aa23e63.png)

注意第二行，这里将$request['id']进行了int类型的数值转换，在php中，$request['id'] =”1grq”会被转换为数值类型1，如下图演示

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/2fc4a0b18c5f936a8442712acf931321.png)

所以这里的$id又由‘1grq’变回1了，get_post()函数也会找到对应id为1的文章了。

**漏洞利用**

目前已经有研究员在GitHub上给出相应的poc，链接如下

https://gist.github.com/leonjza/2244eb15510a0687ed93160c623762ab

**官方修补方案分析**

![](http://blog.nsfocus.net/wp-content/uploads/2017/02/687871c5f29c5e5a8ae2f59d588c441c.png)

在4.7.2版本中，如果get_post()判定$post结果为 false，则直接返回$post，避免$post进入下层if判定绕过权限检查。

**修补防御**

升级wordpress至最新版本（4.7.2）。

### **关于绿盟科技**

北京神州绿盟信息安全科技股份有限公司（简称绿盟科技）成立于2000年4月，总部位于北京。在国内外设有30多个分支机构，为政府、运营商、金融、能源、互联网以及教育、医疗等行业用户，提供具有核心竞争力的安全产品及解决方案，帮助客户实现业务的安全顺畅运行。

基于多年的安全攻防研究，绿盟科技在网络及终端安全、互联网基础安全、合规及安全管理等领域，为客户提供入侵检测/防护、抗拒绝服务攻击、远程安全评估以及Web安全防护等产品以及专业安全服务。

北京神州绿盟信息安全科技股份有限公司于2014年1月29日起在深圳证券交易所创业板上市交易，股票简称：绿盟科技，股票代码：300369。

如果您需要了解更多内容，可以
加入QQ群：570982169
直接询问：010-68438880

<div id="page" class="hfeed site"></div>