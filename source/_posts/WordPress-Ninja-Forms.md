---
title: WordPress Ninja Forms插件 CSRF to XSS漏洞（CVE-2020-12462）分析
tags: web漏洞分析
categories: 技术
cover: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/4a44e04be50baddb294deb2987f7180.jpg
date: 2020-05-25 17:26:34
top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

前言
----

Ninja Forms是一款WordPress插件。使用Ninja Forms插件无需编码即可以创建美观、用户友好的WordPress表单。据统计，全球超过 2,000,000 个网站正在使用 Ninja Forms。

![398968d8e7bc9867d3b1a6adbe0116ef.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154223-72ec2110-95b6-1.png)

Ninja Forms 3.4.24.2之前的所有版本中存在一个严重的CSRF to XSS漏洞。成功利用此漏洞可以使得攻击者将WordPress网站中启用的Ninja Forms表单替换为包含恶意JavaScript的表单。当用户使用这些表单时触发xss漏洞。

漏洞分析
--------

根据漏洞披露来看，本次漏洞存在于ninja-forms\\lib\\NF_Upgrade.php文件 ninja_forms_ajax_import_form函数

在分析漏洞之前，我们先来了解下这个存在漏洞的文件是做什么用的。存在漏洞的文件名为NF_Upgrade.php，从字面意义上来看，是升级的意思，但这个文件的功能并不是如同其命名（Upgrade）那样用来升级ninja-forms插件版本，而是涉及到ninja-forms的一个特殊功能——“降级” 
Ninja Forms插件中存在着一个名为 “降级”的功能。使用该功能用户可以将其表单样式和功能恢复为该插件2.9.x版本

![e20da3119ef76028fa3e3a37be0dbec5.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154248-81cf7a2e-95b6-1.png)

使用降级后，将删除目前安装的3.0版本的所有表单数据。因此该功能提示用户在使用该功能前导出表单数据。

从后台代码来看，点击降级按钮后，程序启用位于deprecated路径的旧版ninja-forms入口文件

![d9b252ead5e8ee9bde1d7a3cc239442a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154307-8cfe46f0-95b6-1.png)

下图是位于deprecated路径的2.x版本ninja-forms入口文件

![6d196c85180ba59685631b8e1c9b7ffb.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154325-984122c6-95b6-1.png)

作为降级功能的一部分，ninja-forms编写了NF_Upgrade.php文件，文件中AJAX函数旨在在使用“降级”模式时可以导入正常模式中导出的表单

在了解了NF_Upgrade.php文件存在的意义之后，接下来分析下NF_Upgrade.php文件中存在漏洞的ninja_forms_ajax_import_form函数

![eee6a010878b0661a9371499d0782159.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154351-a7cacbb6-95b6-1.png)

NF_Upgrade.php文件在25行处通过add_action注册了一个连接到ninja_forms_ajax_import_form函数的hook

![e442a1795467ef2a14b76cd3cc69b03a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154405-afd8a26a-95b6-1.png)

因此可以通过访问如下链接来触发ninja_forms_ajax_import_form函数

![5e84fa9fe6baff8d6ad03f9354b7b668.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154422-b9f45b22-95b6-1.png)

在了解了ninja_forms_ajax_import_form函数如何通过请求调用后，继续分析该函数

![2e6cb612e6e60e233185af20d6a7eea7.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154435-c1ae859a-95b6-1.png)

ninja_forms_ajax_import_form函数在27行处检验了用户权限

![2a7d0123d7ca43a51ab4868646bae619.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154451-cb097988-95b6-1.png)

在29行处获取POST请求中import参数，在31行处获取POST请求中formID参数

![fbf1348147641834fdae1d09dbf3e71c.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154508-d51adbc4-95b6-1.png)

程序在35行处将POST中提交的import参数与formID参数传入import_form函数中进行导入处理

ninja_forms_ajax_import_form函数的作用，从对上文代码的理解，应该是用来给管理员提供导入表单功能用的。

但是ninja_forms_ajax_import_form函数在安全上仅仅校验了使用者的权限，这点确实可以防止未授权访问的发生，但并未校验提交表单中的csrf token进行校验，并不能防范csrf漏洞，因此攻击者可以构造一个恶意页面链接诱骗管理员点击，从而向Ninja Forms插件提交一个导入恶意表单的请求。

ninja_forms_ajax_import_form函数接收POST传入的两个参数：import参数与formID参数，import参数中的内容是导入表单的数据，formID参数值是对应的表单id。经过实际测试发现，如果formID参数设置为一个已经存在的表单，则导入的表单内容将会覆盖原有表单。

在测试环境中有如下表单normal_form。攻击者可以通过查看使用该表单的页面源码来获得formID，这里normal_form的formID为2

![895d5b13349ae3e97defd1fac120bf3f.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154531-e34f99f0-95b6-1.png)

normal_form是一个简单的单行文本表单

![b97353c9484d2aec2ec15f97e5abad36.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154547-ecc580f8-95b6-1.png)

如果攻击者向在这个表单中插入一些恶意的js脚本，则可以在攻击时指定POST中formID为2

要覆盖的目标有了，但是导入的数据信息到底怎么构造呢？

回头看下ninja_forms_ajax_import_form函数

![523972b734099bb08d2b20f34fc30993.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154602-f5de68da-95b6-1.png)

ninja_forms_ajax_import_form函数从POST请求中获取import参数，这个值就是导入模板的信息。接着程序将其传入import_form方法中进行导入处理。

$_POST[‘import’]值应该是什么样子的呢？只有知道了这个值的格式，我们才好构造payload

经过一番搜索，位于wp-content\\plugins\\ninja-forms\\ninja-forms.php文件中
![d639017a1f244b1fdcbafe541c18a57b.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154616-fe19ec22-95b6-1.png)

我们可以看到如上的代码

可见程序通过template方法读取位于wp-content\\plugins\\ninja-forms\\includes\\Templates\\
文件夹的formtemplate-contactform.nff文件内容，并传入import_form接口

formtemplate-contactform.nff文件是这个样子的

![41e9ab63e926d69e4e8f68236a7b98ea.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154631-0702b3e6-95b7-1.png)

到这里就很好办了，.nff文件正是ninja forms插件导出表单的默认格式。

![097b4271d4bcfb4c33ecec2af1560245.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154648-10f2fcb2-95b7-1.png)

因此利用思路比较清晰了

1.  攻击者在本地模仿目标表单模板构造一个含有恶意代码的表单模板

2.  通过ninja forms插件将其导出为.nff文件

3.  构造csrf页面，该页面会在管理员访问时发起csrf攻击，使用恶意的表单模板替换原有模板

4.  诱使管理员访问

5.  当用户与管理员使用这个恶意表单的页面时，xss将会被触发

现在已经理清利用思路，接下来构造一个恶意的.nff文件。模仿上文的normal_form表单，攻击者可以构造一个与之相似的恶意表单，与之不同的是，攻击者在描述处加入一行js脚本

![ccbffa34e0f175592e49ef057d5f24ff.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154709-1d908e8a-95b7-1.png)

攻击者将这个恶意的表单模板导出

![097b4271d4bcfb4c33ecec2af1560245.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154727-284e1536-95b7-1.png)

导出的恶意表单部分内容如下

![224d79451025a8c36178bfab115c3771.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154740-2ff963f8-95b7-1.png)

攻击者构造一个表单提交页面，表单提交的地址为http://x.x.x.x/wordpress/wp-admin/admin-ajax.php?action=ninja_forms_ajax_import_form
提交内容中import值为恶意文件内容、formID值为要覆盖的原normal_form的id，并诱使管理员点击页面链接

当攻击成功后，normal_form表单将会被恶意的表单覆盖

当用户使用该表单进行提交时

![cc91b4c75a04cdc63ff81dde5779063a.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154755-38ee6cce-95b7-1.png)

点击submit时xss被触发

![31b46fa45c241f800c81f746e79589da.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154809-4125abaa-95b7-1.png)

不仅如此，当管理员在后台管理编辑该表单时，当进入编辑页面，xss仍然可以被触发

![b6ae533afbf1b1f01c602420752d7ca2.png](https://xzfile.aliyuncs.com/media/upload/picture/20200514154824-49ffe736-95b7-1.png)


总结
----

该漏洞在3.4.24.2版中完全修复。在分析这个漏洞的过程中，发现ninja_forms插件非常的好用，推荐有需要的朋友可以试用下。