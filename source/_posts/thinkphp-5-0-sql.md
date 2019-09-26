---
title: ThinkPHP 5.0版本 SQL注入漏洞分析
date: 2018-04-18 15:36:50
tags: web漏洞分析
categories: 技术
---

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/u2005892999878764991fm27gp0.jpg)

前段时间，ThinkPHP发布了V5.0.16版本的release，该版本提到了安全更新。本篇文章以此次安全更新入手，对ThinkPHP 5.0版本 SQL注入漏洞进行了详细分析。文末还有测试小问题，看看大家get到这个漏洞的精髓了吗？

<!--more-->

## 前言

Thinkphp V5.0.16版本的release说明如下：

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/图片-1-8.png)

说明中提到了安全更新，但并没有提到是什么安全问题。

V5.0.16的commits记录如下，可以看到在3月26日出现了一个关于安全性的提交，但26日似乎没有一次性改好，在27日又对这个inc/dec查询改动了一次

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/2-11.png)

接下来看下这个inc/dec查询到底有什么问题，需要一改再改。

## **漏洞分析**

先看下26日改了什么

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/3-11.png)

再看看27日改了什么

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/4-10.png)

改动都在Builder.php这个文件的相同位置，而且反反复复的折腾的，就是$val[1]这个变量。

接下来看看完整的函数部分，看看$val[1]到底怎么了。

漏洞部分在parseData函数
<pre class="lang:default decode:true">protected function parseData($data, $options)
{
    if (empty($data)) {
        return [];
    }

    // 获取绑定信息
    $bind = $this-&gt;query-&gt;getFieldsBind($options['table']);
    if ('*' == $options['field']) {
        $fields = array_keys($bind);
    } else {
        $fields = $options['field'];
    }
    
    $result = [];
    foreach ($data as $key =&gt; $val) {
        $item = $this-&gt;parseKey($key, $options);
        if (is_object($val) &amp;&amp;method_exists($val, '__toString')) {
            // 对象数据写入
            $val = $val-&gt;__toString();
        }
        if (false === strpos($key, '.') &amp;&amp; !in_array($key, $fields, true)) {
            if ($options['strict']) {
                throw new Exception('fields not exists:[' . $key . ']');
            }
        } elseif (is_null($val)) {
            $result[$item] = 'NULL';
        } elseif (is_array($val) &amp;&amp; !empty($val)) {
    
            switch ($val[0]) {
    
                case 'exp':
                    $result[$item]= $val[1] . '+' . floatval($val[2]);
                    break;
                case 'inc':
                    $result[$item]= $this-&gt;parseKey($val[1]) . '+' . floatval($val[2]);
                    break;
                case 'dec':
                    $result[$item]= $this-&gt;parseKey($val[1]) . '-' . floatval($val[2]);
                    break;
            }
        } elseif (is_scalar($val)) {
            // 过滤非标量数据
            if (0 === strpos($val, ':') &amp;&amp;$this-&gt;query-&gt;isBind(substr($val, 1))) {
                $result[$item] = $val;
            } else {
                $key = str_replace('.', '_', $key);
                $this-&gt;query-&gt;bind('data__' . $key, $val, isset($bind[$key])? $bind[$key]: PDO::PARAM_STR);
                $result[$item] = ':data__' . $key;
            }
        }
    }
    return $result;
}
</pre>
可以看出这个方法是用来传入的字典类型$data数据的，具体传入的$data是什么，还需要进一步分析。

先不管调用关系，单单看这个方法，在处理$data的value时，会分情况处理，

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/5-10.png)

是否是空，是否是数组，是否是常量，而漏洞恰恰出在了是否是数组这个elseif上了。

接下来看看谁调用了parseData，传入的$data又是什么。

向上跟踪到Builder.php中的insert方法

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/6-10.png)

这个insert也不是最上层，但我们就先看看这个insert做了什么。

假如最上层入口的$data我们可控，$data这个字典中的value值还是个数组，那个经过parseData方法后，最终的返回值就可控，原因如下：

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/7-7.png)

只要$val[0]的值是exp/inc或者是dec，那么我们就能将$val[1]恶意构造的值传入$result[$item]中，这个$result值最终会返回给insert方法中的$data变量，看下图：

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/8-7.png)

并且，最终$fields的值会是$item的值;$values的值会是$result[$item]的值，即为

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/9-6.png)

不要担心这个parseKey方法会破坏我们构造的$val[1],因为。。。。

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/10-6.png)

到目前为止，我们的推断是，只要$data的值可控，那么我们就能将恶意构造的值传入$values这个参数。接下来，看看$values这个可控参数又如何造成sql注入的。

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/11-5.png)

很明显，这里是要拼接sql语句了，最终的$values会被拼接到$sql变量中

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/12-5.png)

抛开恶意构造的部分，有经验的朋友一看就能想到这个$sql变量是要做什么的。对，这个$sql变量是要用作参数化查询的sql指令部分。

为了验证我们的猜想，继续往上层跟踪。

在\library\think\db\Query.php中，调用了我们刚才分析的builder中的insert方法

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/13-4.png)

刚才的$sql变量，这次又传递给了Query.php中的$sql变量了，这里的$bind，实际上就是用来取出真是value值的。

然后在上图红圈中，使用execute进行参数化查询。由于$sql变量可控，里面可以包含我们传入的恶意字符串，因此，即使用了参数化查询，也没法避免sql注入的产生。

这个漏洞怎么利用呢？这关系的Query.php中的这个insert方法，看看thinkphp中关于这个方法的使用说明

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/14-4.png)

我这里给个demo，帮助大家理解下应用场景。

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/15-4.png)

## **总结**

理论上来说，利用参数化查询，将要执行的sql语句和参数分开传入，的确可以防止sql注入的产生。但是像这个案例，要执行的sql语句中的内容竟然可控，那就比较尴尬了。

## **思考**

漏洞分析虽然告一段落了，这里我给大家提出几个问题，看看大家有没有真的弄明白这个漏洞。

1.  如果我直接通过get方法传入一个字符串，这个漏洞会利用成功吗？
2.  最终的修补如下图
![](http://blog.nsfocus.net/wp-content/uploads/2018/04/16-4.png)

当$val[0]=exp的时候，$val[1]仍然可控，并且也传入了$result[$item]里了，这里是否还是有漏洞呢？为什么thinkphp不修这里呢？

**答案**

*   get传入的值如果是一个字符串，最终会到如下这里
![](http://blog.nsfocus.net/wp-content/uploads/2018/04/17-4.png)

最终的$result[$item]中的$key值是不可控的，

对于我给出的那个例子

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/18-3.png)

$key就是红圈中的内容

因此最终执行时，$sql不可控，还利用了参数化查询，完全没有注入的可能，如下图

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/19-2.png)

&nbsp;

**答案2**

这个问题也困扰到我了，找到这个问题的时间简直比分析漏洞的时间还长。

通过Input方法传入的变量，会中途经过\library\think\Request.php中的input方法进行处理，然而在这个方法中，有一个过滤器。。。

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/20-2.png)

如果$data是数组形式的，就利用$this-&gt;filterValue进行处理

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/21-2.png)

这个过滤器还没对我们的$data下手，注意看红框处，filterExp

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/22-2.png)

在这里，filterExp如果匹配到了exp，则会给它后面加一个空格，这就导致了我们通过get/post

提交进来的数组中，如果有exp，则会被处理为“exp ”，因此无法进入”exp”这个case

![](http://blog.nsfocus.net/wp-content/uploads/2018/04/23-2.png)