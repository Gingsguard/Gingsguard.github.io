---
title: PHP漏洞跟踪报告
date: 2017-11-1 14:30:10
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

由于SugarCRM 6.5.18系统没有对提交的url参数进行过滤，攻击者可以提价一个构造好的url参数，从而将恶意代码写入网站目录中的配置文件中去，配置文件进一步被其他文件包含，导致恶意代码被触发。

<!--more-->[![php1](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP1-300x187.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP1.jpg)

## 修补情况

**SugarCRM ****新版本中被修复**。

## 参考资料

http://seclists.org/fulldisclosure/2016/Jun/51

## 技术细节

现在已知的POC如下图所示：

执行POC，我们可以看到这样的结果

[![php2](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP2-300x21.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP2.jpg)

执行POC，我们可以看到这样的结果

[![php3](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP3-300x212.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP3.jpg)

下面我们就要通过poc去分析漏洞的形成原因。

找到文件\modules\Connectors\controller.php

[![php4](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP4-300x114.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP4.jpg)

<pre class="lang:default decode:true ">$source = SourceFactory::getSource($source_id); 这里动态调用了函数getSource()</pre>

我们来看看getSource()函数

[![php5](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP5-300x267.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP5.jpg)

getSource()函数在这里包含了\include\connectors\sources\default\source.php

我们回头继续看controller.php

[![php6](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP6-300x47.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP6.jpg)

这里用了个foreach进行遍历，将$_REQUEST提交上来的键名赋值给$name变量、键值赋值给$value变量，然后在判断键名中是否有符合正则表达式"/^{$source_id}_(.*?)$/"的匹配内容，并且将匹配值赋值给$matches变量。

我们来看一下poc提交的所有参数

<pre class="lang:default decode:true ">module=Connectors&amp;action=RunTest&amp;source_id=ext_rest_insideview&amp;ext_rest_insideview_[%27.phpinfo().%27]=1
这里参数&amp;source_id值为ext_rest_insideview
经过匹配，最后的结果为：
$properties[“[%27.phpinfo().%27]”] = “1”;
</pre>

接下来看下一条语句

<pre class="lang:default decode:true ">$source-&gt;setProperties($properties);
Set Properties()函数在\include\connectors\sources\default\source.php文件中
</pre>

[![php7](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP7-300x68.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP7.jpg)

<pre class="lang:default decode:true ">这里把$properties数组赋给$this-&gt;_config['properties']，这里相当于生成了一个二维数组。
并且$this-&gt;_config['encrypt_properties'] =true
</pre>

然后再看下一行代码

<pre class="lang:default decode:true ">$source-&gt;saveConfig();</pre>

saveConfig()函数同样也在在\include\connectors\sources\default\source.php文件中：

[![php8](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP8-300x170.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP8.jpg)

我们看一下红框里的代码：这里调用了override_value_to_string_recursive2()函数进行拼接字符串，接下来我们看一下override_value_to_string_recursive2()函数。

override_value_to_string_recursive2()函数位于/include/utils/array_utils.php文件中

[![php9](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP9-300x106.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP9.jpg)

经过函数处理，最后输出的值应该为$config['properties'][''][''.phpinfo().''] = '1';

然后被写入custom/modules/Connectors/connectors/sources/{$dir}/config.php文件中去。

整体流程下来，我们大概了解了poc的构造原理，也明白了漏洞触发的原因，那么我们再看一下poc

[![php10](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP10-300x23.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP10.jpg)

这里面的source_id的值即“ext_rest_insideview”字符串貌似没有什么作用啊，看起来只是让source_id的值的后面的变量名前半部分一样就好了。我尝试替换下试试。

[![php11](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP11-300x13.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP11.jpg)

但是不能触发漏洞，结果如下图

[![php12](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP12-300x101.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP12.jpg)

发现SourceFactory.php的61行出现错误，我们看一下getSource()中的内容：

[![php13](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP13-300x122.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP13.jpg)

看来是load函数出现问题了，load()函数位于include/connectors/ConnectorFactory.php中

[![php14](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP14-300x151.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP14.jpg)

可见load()函数调用了loadclass()函数，根据报出的错误猜测是loadclass()函数没有包含到相应的文件。

我们看一下三条if语句中要包含的文件：

<pre class="lang:default decode:true ">custom/modules/Connectors/connectors/{$type}/{$dir}/$file
modules/Connectors/connectors/{$type}/{$dir}/$file  
connectors/{$type}/{$dir}/$file 
</pre>

在这里，$type参数是固定的，即是SourceFactory.php传入的’sources’

[![php15](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP15-300x80.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP15.jpg)

$dir参数就是用get传入的source_id拼接的，例如source_id = “a_b_c”， $dir = “a/b/c”

$file参数要是$dir最后一个目录的值加上”.php”,如前面那个例子，这里的即$file = ”c.php”

所以我们要找到一个存在的文件满足如下一个条件，就可以触发漏洞：

<pre class="lang:default decode:true ">1、custom/modules/Connectors/connectors/sources/a/b/c/c.php
2、modules/Connectors/connectors/sources/a/b/c/c.php 
3、connectors/sources/a/b/c/c.php 
</pre>

这里a、b、c可以是任意字符串

我们这里找了一处付符合条件的举例说明：

[![php16](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP16-300x276.jpg)](http://blog.nsfocus.net/wp-content/uploads/2016/11/PHP16.jpg)

### 漏洞检测

如果对目标网站服务器中的url申请中含有poc中所示的请求，就有极大的可能是攻击行为。

如果您需要了解更多内容，可以
加入QQ群：570982169、486207500
直接询问：010-68438880-8669