---
title:  CVE-2020-26217/26259 Xstream远程代码执行/任意文件删除漏洞分析
tags: web漏洞分析
categories: 技术
top_img: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg'
cover: 'https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/553447ca56752dd4b133c4afe70cedc.jpg'
date: 2020-12-22 10:31:37
---

XStream是一个基于Java库，可以将Java对象序列化为XML，反之亦然。

2020年，Xstream有两个影响比较大的高危漏洞被爆出：CVE-2020-26217远程代码执行漏洞与CVE-2020-26259任意文件删除漏洞。纵观两个漏洞，他们出现的原因与机制上极其相似，因此我们在这里放到一块来分析。

理解poc
-------

首先把CVE-2020-26217与CVE-2020-26259的poc放到一起比较下：

![d34797a4ddc5b43d65081945ef66df44.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101608-a711bcea-43fb-1.png)

从上图两个漏洞poc的对比上来看：二者利用链前半部分都是一样的，只有中间is元素的class属性值不同：其中一个为java.io.SequenceInputStream而另一个为com.sun.xml.internal.ws.util.ReadAllStream$FileStream。

因此，我们可以先从他们相同部分的调用链入手分析，等到了他们分歧之处，我们再分开来分析。在分析漏洞之前，我们需要搞明白poc中的元素以及其属性到底代表什么意思。

由于poc是个xml格式，我们一层层来剖析这个xml。首先把poc元素折叠起来，看看entry元素中包含的元素内容，见下图：

![83aa880b6449414c98b27ded50dc526d.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101620-ae32e15c-43fb-1.png)

entry元素中包含了jdk.nashorn.internal.objects.NativeString与string两个元素

上图这样的结构代表什么意思呢？又是怎么生成的呢？

我们本地做了一个demo，看一下下面的例子：

![892079c7fe99ee385d914598e4e71742.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101630-b43b22ee-43fb-1.png)

在这个demo中，HashMap的key为一个Person对象，而value为String类型”test”

Xstream将这个map输出为下图形式

![1592bbe0c1825fe08c95801dfc8b75a9.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101643-bbc2848a-43fb-1.png)

让我们对比一下poc与我们测试demo

![1c790c9505e2b94baf387ec748035bb6.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101652-c1a4211a-43fb-1.png)

从我们的demo与实际poc两个例子可以看出：在Xstream将Map生成xml格式数据时，会为每个Entry对象生成一个<entry>…</entry>元素，并将该Entry中的key与value作为其子元素顺次放置于其中第一个和第二个元素处。因此我们可以通过这个特点推断出，poc中jdk.nashorn.internal.objects.NativeString与string两个元素其实就是该Entry的key与value。此外，我们回头看一下我们的demo

![e7ffb7bf7da93d3b2e38634409da77e1.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101701-c6e90da2-43fb-1.png)

从上图可见：在生成xml时，我们为Person对象赋值的name（“kumamon”）与age（3）属性值成为了Person对象节点(<Person>…</Person>)的子元素(<name>…</name>、<age>…</age>)

因此可以推断，当一个java对象通过Xstream生成xml时，其结构应遵循如下结构：

![63ece0f9306b3ecfb8129f2c38648d7f.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101710-cc23fe9e-43fb-1.png)

回头看一下我们的poc，我们再展开一级看看

![16ce0ebdf3377e6df85265b6a555bd2a.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101719-d17ac30a-43fb-1.png)

通过上文的理解，上图poc可以理解为一个map集合，其中存在key为jdk.nashorn.internal.objects.NativeString对象、value值为test的Entry。而jdk.nashorn.internal.objects.NativeString对象又存在flags、value属性，它的flags属性值为0、value属性值为com.sun.xml.internal.bind.v2.runtime.unmarshaller.Base64Data

在弄明白poc结构之后，我们来调试下poc的解析的过程

Xstream程序在解析xml时遇到Map结构后，会新建了一个map并将xml中key-value对取出并put入其中，见下图

![878db342566da34f2d1bf5456e32f6c8.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101729-d75f165e-43fb-1.png)

上图key值即为poc中Entry内key值(NativeString对象)，而values则为Entry中value（test字符串）

根据map的原理可知：map在put key操作时需要获取key的hash值。因此程序调用了jdk.nashorn.internal.objects.NativeString的hashCode方法，见下图

![8b0d0e61c6ca62b242ecb1a2bd87cc4e.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101739-dd3e88de-43fb-1.png)

从上图可见，程序调用了getStringValue方法，我们跟入这个方法，见下图：

![dc8c73bf3c6ab518f21357c8c8a8dc77.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101750-e4194d38-43fb-1.png)

在这个方法中，程序将判断this.value是否为String实例，并尝试调用this.value.toString方法

经过上文对poc的分析，此时的this.value其实就是<jdk.nashorn.internal.objects.NativeString>

…</jdk.nashorn.internal.objects.NativeString>元素中的value子元素值，攻击者可以通过xml中NativeString元素的value子元素控制。在官方给出的poc中，将value值构造为com.sun.xml.internal.bind.v2.runtime.unmarshaller.Base64Data类。见下图

![e5f9a82693002f1ff0ffdb99e397876e.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101801-ea535fe0-43fb-1.png)

因此，此时this.value为com.sun.xml.internal.bind.v2.runtime.unmarshaller.Base64Data。程序调用Base64Data类的toString方法，见下图：

![76ed589f2d9e2905b6eae30f313a7c3c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101809-ef7c00e4-43fb-1.png)

Base64Data类中toString方法首先调用了其自身的get方法，跟入get方法中，见下图：

![15fec8fb304d6f3b08b3c9522f726a73.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101819-f5394f82-43fb-1.png)

分析上图代码：this.dataHandler.getDataSource().getInputStream();将其拆分来看：

>1.  首先程序执行this.dataHandler.getDataSource()，即是获取Base64Data对象中dataHandler属性的DataSource值。Base64Data的dataHandler属性值以及dataHandler的dataSource属性值都可以在xml中设置。poc中将dataSource设置为：com.sun.xml.internal.ws.encoding.xml.XMLMessage$XmlDataSource。因此this.dataHandler.getDataSource()获取的值为：com.sun.xml.internal.ws.encoding.xml.XMLMessage$XmlDataSource
>2.  随后程序执行com.sun.xml.internal.ws.encoding.xml.XMLMessage$XmlDataSource类的getInputStream方法，这将获取com.sun.xml.internal.ws.encoding.xml.XMLMessage$XmlDataSourc的is属性值



CVE-2020-26217与CVE-2020-26259两个POC中设置的DataSource的is属性值不同，这将导致两个漏洞进入了不同的调用链。我们先来看看CVE-2020-26217

CVE-2020-26217
--------------

我们来看看CVE-2020-26217 的poc中DataSource元素包含的is元素是什么

![f0e4141c96e9cd4639cff3947463465e.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101830-fb813ee0-43fb-1.png)

通过上图可见，poc中构造的is值为java.io.SequenceInputStream

随后，程序将is变量传入readFrom方法中，见下图

![99aab2931c1ff9c012f521942bd90e2d.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101838-0070b822-43fc-1.png)

readFrom方法实现如下：

![1fc784e3f0a2fbd3f330ae0f250e764f.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101847-05a99430-43fc-1.png)

此时的is变量为java.io.SequenceInputStream，随后程序调用java.io.SequenceInputStream类的read方法

![d2a5d9c57242dd3eacac8b70d049d71c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101856-0b809b1a-43fc-1.png)

从上图可见，程序将调用java.io.SequenceInputStream类的read方法中的nextStream方法，跟入nextStream方法中，见下图：

![6e18d9427d989ff5bc74288c7672f010.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101905-1083bc6e-43fc-1.png)

从上图110行可见，程序将执行in = (InputStream) e.nextElement();

而e的值，可以通过向xml中SequenceInputStream元素中的e元素值来控制。在poc中将这个e元素值设置为javax.swing.MultiUIDefaults$MultiUIDefaultsEnumerator，见下图

![5e8d4f1fbc9a61ff3f8d87925ce059dd.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101914-15eab5ae-43fc-1.png)

因此，程序事实上调用的是javax.swing.MultiUIDefaults$MultiUIDefaultsEnumerator的nextElement方法。接下来进入位于javax/swing/MultiUIDefaults.java中的nextElement方法

![36179f060686fbd3c4e63d02319bc5f9.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101922-1ad15c12-43fc-1.png)

可见，这次需要执行的是iterator.next().getKey();

我们需要为javax.swing.MultiUIDefaults$MultiUIDefaultsEnumerator对象构造一个满足要求的iterator属性值。通过分析poc可知，poc中选取了javax.imageio.spi.FilterIterator作为iterator属性值，见下图：

![7493c31ccbe9e06095ec1152db984aad.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101931-201c4290-43fc-1.png)

跟入位于javax/imageio/spi/ServiceRegistry.java的javax.imageio.spi.FilterIterator类的next方法，见下图：

![a384d286798cd42d1731cee9d4d1e527.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101940-253c5184-43fc-1.png)

在javax.imageio.spi.FilterIterator类的next方法中，执行advance方法。跟入advance方法

![44a02b99fd6415ef9166f1ed0cdcb0b6.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101948-2a59a82e-43fc-1.png)

从上图可见，程序执行了T elt = iter.next();
此时的iter显然可以通过xml中javax.imageio.spi.FilterIterator元素中iter元素控制，我们看一下poc中构造的iter子节点，见下图

![93ba1f00ebcb9d2f282000f71a151bf7.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222101958-300a5098-43fc-1.png)

当iter.next()执行后，poc中构造的java.lang.ProcessBuilder被返回并赋值给elt，见下图

![30bf493a1edab443e8344fa49477501b.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102006-34f78a58-43fc-1.png)

随后，程序执行filter.filter(elt)

![b9fbc07f738628acd033293b75e4a4fb.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102015-3a6dfd32-43fc-1.png)

很显然，filter值是可以通过xml中javax.imageio.spi.FilterIterator元素中filter元素控制的。看一下poc

![2399d10456b0b8ca2b80530558fd6638.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102025-404882b8-43fc-1.png)

Filter赋值为javax.imageio.ImageIO$ContainsFilter类

我们跟入javax.imageio.ImageIO$ContainsFilter类的filter方法中，位于javax/imageio/ImageIO.java

![07cb916ddd1ecccab1826e6d02e2332a.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102034-456e0808-43fc-1.png)

可见在javax.imageio.ImageIO$ContainsFilter类的filter方法中，执行了method.invoke(elt)。method可以通过xml中javax.imageio.ImageIO$ContainsFilter元素包含的method元素控制，见poc

![3b7db9c50a524053543af100954a2725.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102043-4ad23f94-43fc-1.png)

此时method为ProcessBuilder类的start方法，而通过上文可知：elt为构造好的java.lang.ProcessBuilder对象。在method与elt都可控的情况下，进行反射调用即可实现远程代码执行利用。

我们接下来看看CVE-2020-26259任意文件删除漏洞

CVE-2020-26259
--------------

首先分析下CVE-2020-26259的poc

![9487c50fd32f234881fa16a9ce39323f.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102054-516f3942-43fc-1.png)

从poc中可以发现：CVE-2020-26259的poc中is元素为com.sun.xml.internal.ws.util.ReadAllStream$FileStream，这与上一个漏洞poc不一样。

值得注意的是，这次漏洞利用的不是Base64Data中get方法里的baos.readFrom(is)这个入口，而是位于它下面一行的is.close()这行代码。通过调试，程序在执行过get方法中baos.readFrom(is)后，紧接着执行is.Close()，见下图：

![c40109bfe416f80101dd1aa35c11b9c4.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102102-56a91cca-43fc-1.png)

此时的is是com.sun.xml.internal.ws.util.ReadAllStream$FileStream，跟入com.sun.xml.internal.ws.util.ReadAllStream$FileStream中的close方法，见下图：

![d783f17d2981353ed8d3e6b5d0375d6c.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102111-5c093aec-43fc-1.png)

当com.sun.xml.internal.ws.util.ReadAllStream$FileStream对象的tempFile属性值不为空时，删除tempFile文件。

tempFile是com.sun.xml.internal.ws.util.ReadAllStream$FileStream对象的属性值，因此可以直接在poc中com.sun.xml.internal.ws.util.ReadAllStream$FileStream元素内构造tempFile属性元素，通过tempFile属性元素控制要删除的文件，见下图poc

![53b7006a07a7e5b96da67628c16cc974.png](https://xzfile.aliyuncs.com/media/upload/picture/20201222102121-61805992-43fc-1.png)

到此，一个任意文件删除漏洞产生了

总结
----

通过对这两个漏洞的分析不难发现，CVE-2020-26259其实是CVE-2020-26217的一个思路上的延伸：在is可控时，既然baos.readFrom(is)可以利用，那么is.close()是否也能构造出一个利用链呢？从CVE-2020-26259答案上来看是可以的。

从CVE-2020-26259也可以延伸出另一个问题：只要找到一个类，其中存在close方法且close方法中有可利用的地方，那么一条新的利用链就被挖掘出来了。