---
title: 震惊！Hexo+github创建个人博客避坑攻略
date: 2017-05-18 19:31:00
tags: 技术分享
categories: 技术
---
<div align=center>
{% asset_img 0.jpeg%}
</div>
I have a dream！我要有个<font color=#FF7F50>免费</font>blog！

使用hexo + github + theme，建立一个自己的blog并非困难，网上的相关资料很多，也很详细。

具体的搭建过程可以参照这个链接: https://zhuanlan.zhihu.com/p/22191919。

另外附上hexo的官方文档链接: https://hexo.io/zh-cn/docs/。

很easy吧！很刺激吧！震惊吧！在读完上面的搭建过程后，如果后仍有兴趣搭建一个自己的Glog，在动手前，请先看看我这篇文章。

这篇文章重点<font color=#FF7F50>不是</font>教你如何建立博客，而是写一点我实战中遇到的坑，好让大家避开坑。下面我要开始讲讲怎么<font color=#FF7F50>避坑</font>了。
<!--more-->
</br>  
### 项目命名问题
<div align=center>
{% asset_img 1.png%}
</div>
我嫌原作者画的圈不够粗，重新在这里强调一下，这个项目的命名一定要是<font color=#FF7F50>你的github账号名</font>.github.io，要不github一定狠狠地把404甩你脸上。

这个项目名称也是作为你blog建立起来后访问的网址，如果嫌你github名字起的太随意，先改一下自己的github账户名再来建项目。

Github改账户名在下图这里
<div align=center>
{% asset_img 2.png%}
</div>
<div align=center>
{% asset_img 3.png%}
</div>
</br>
### 在不同电脑上更新博客
你需要在公司和家里两台电脑上更新博客，虽然说hexo控制端是在本地工作的的，但是你在公司电脑上新生成了一个文章，hexo d发布了，回家后，一不小心在电脑上hexo d 了一下，家里电脑中并没有你新生成的文章的md文件。结果是blog上内容又还原到你家里电脑中的状态了。
惊喜不！
其实解决办法很简单，把hexo控制端也放到你的项目里作为一个分支，完成修改时候push下，然后用的时候pull一下就可以了，方法如下:
```
在你项目里创建一个分支：hexo，这时候你的这个项目里就有两个分支了，master放hexo生成的静态网站，hexo放你的hexo控制端代码
把项目hexo分支克隆到你用的几台机器上，切到hexo分支
每次要用hexo控制端时，先pull下最新的commit
删除目录下.deploy_git/（这个是个大坑，有时hexo d会出冲突，这个默认是隐藏的，ubuntu可以用ll指令显示）
开始你的表演（写文章或是其他的。。。）
当决定要结束这台机器上的创作了，依次执行git add .、git commit -m "..."、git push hexo提交控制端变动；
```
</br>
### theme的选择与使用
先附上hexo的主题链接: https://hexo.io/themes/

选择一个你喜欢的主题，进入对应的github项目中clone这个主题到本地themes文件夹中并分别在hexo的_config.yml和主题的_config.yml中配置相关配置。

这里的坑是，如果直接将中意的主题git clone到你的themes文件夹中，假如你的hexo控制端文件夹本来就是个git项目，这个项目里的themes文件夹里又嵌套了个git项目，就会导致被嵌套的git仓库的改动，不能被大git仓库检测到。这样最直观的

针对这种问题，可以直接把主题中的.git/文件删除，或者直接下载项目的压缩包然后在themes文件夹中解压。
</br>
### md文件的修改与编写
hexo使用markdown来编辑文章，在markdown中，可以用#来标识几级标题。
但是在我写这篇文章时，发现###标题###没有被解析，原封不动的被打印出来了，如过出现这种情况，请记得试试在#与标题文字之间加一个空格，这种情况同样适用于_config.yml配置文件的修改中，参数和值之间的空格千万别忘记了（如source_dir: source之间的空格）




