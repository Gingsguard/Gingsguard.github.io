---
title: DjangoUEditor任意文件上传漏洞分析
date: 2017-05-19 01:27:03
tags: web漏洞分析
categories: 技术
---
<div align="center">{% asset_img 0.jpg%}</div>
Django是Python世界最有影响力的web框架。

DjangoUeditor是一款可以在Django应用中集成百度Ueditor HTML编辑器的插件（Ueditor HTML编辑器是百度开源的在线HTML编辑器）。

DjangoUeditor插件上存在一个漏洞，可以导致任意文件上传。
<!--more-->
</br>
### 影响版本
DjangoUeditor < 1.9.143
</br>
### 漏洞分析
最近在学习分析python web框架方面的漏洞，恰好看到了WooYun 上2015年的一个关于DjangoUeditor的漏洞，就拿来分析一下。

不要看这个漏洞距今已经快两年了，笔者认为这个漏洞还是有分析的价值的，因为DjangoUeditor作为一个由百度开发的富文本编辑器Ueditor移植到Django中的组件，它的使用率还是挺高的；再者，DjangoUeditor于2015年1月17号后，再也没有更新过，见github上作者的说明：
<div align="center">{% asset_img 1.jpg%}</div>
经笔者测试，现在可以下载使用的1.9.143版本中，依然存在着这个漏洞。因此这个漏洞依然有着一定的影响的。

下面开始正式分析下这个漏洞，根据wooyun上的说明，可以在利用这个插件进行上传图片时，改变imagePathFormat变量的值，即可上传任意文件。

搭建好环境后，来看一下后台的样式，如下图所示
<div align="center">{% asset_img 2.jpg%}</div>
我们来传一张图片并抓包看一下，如下图所示：
<div align="center">{% asset_img 3.jpg%}</div>
注意图中两处红圈处，其中一处便是wooyun中提到的imagePathFormat参数，另一处action参数，这个参数在下文中会用到。

可以看出，当上传一个图片（或者是文件）时候，POST提交的路径是/ueditor/controller/，我们看看DjangoUeditor的路由怎么定义的，来看一下后台代码DjangoUeditor/urls.py
```python
#coding:utf-8
from django import VERSION
if VERSION[0:2]>(1,3):
    from django.conf.urls import patterns, url
else:
    from django.conf.urls.defaults import patterns, url

from views import get_ueditor_controller
urlpatterns = patterns('',
    url(r'^controller/$',get_ueditor_controller)
)
```
从urls.py中可以看到，路由定义到views.py中的get_ueditor_controller方法上去了
接下来跟到views.py中去，找到get_ueditor_controller方法
```python
def get_ueditor_controller(request):
    """获取ueditor的后端URL地址    """
    action=request.GET.get("action","")
    reponseAction={
        "config":get_ueditor_settings,
        "uploadimage":UploadFile,
        "uploadscrawl":UploadFile,
        "uploadvideo":UploadFile,
        "uploadfile":UploadFile,
        "catchimage":catcher_remote_image,
        "listimage":list_files,
        "listfile":list_files
    }
    return reponseAction[action](request)
```
传入的action参数值是uploadimage，因此接下来return进入对应的UploadFile方法

跟到UploadFile方法中看一看（已省略中间若干代码）
```python
ef UploadFile(request):
    """上传文件"""
    。。。。。。。。。。。。。。。。
   
    #检测保存路径是否存在,如果不存在则需要创建
    upload_path_format={
        "uploadfile":"filePathFormat",
        "uploadimage":"imagePathFormat",
        "uploadscrawl":"scrawlPathFormat",
        "uploadvideo":"videoPathFormat"
    }

    path_format_var=get_path_format_vars()
    path_format_var.update({
        "basename":upload_original_name,
        "extname":upload_original_ext[1:],
        "filename":upload_file_name,
    })
    #取得输出文件的路径  OutputPathFormat,OutputPath,OutputFile=get_output_path(request,upload_path_format[action],path_format_var)
```
注意最后一行，在这里调用了一个get_output_path方法来获得输出文件路径以及各式话后的文件名。

为什么要注意这个get_output_path方法呢？回想一下，这个漏洞注入点是什么？是imagePathFormat参数，这里传入get_output_path方法的第二个参数upload_path_format[action]值是什么？见下图。
<div align="center">{% asset_img 4.jpg%}</div>
当action参数值是uploadimage时，upload_path_format[action]值为 imagePathFormat，imagePathFormat将作为第二个参数的值进入get_output_path方法。

接下来跟进get_output_path方法
```python
def get_output_path(request,path_format,path_format_var):
    #取得输出文件的路径
    OutputPathFormat=(request.GET.get(path_format,USettings.UEditorSettings["defaultPathFormat"]) % path_format_var).replace("\\","/")
    OutputPath,OutputFile=os.path.split(OutputPathFormat)
    OutputPath=os.path.join(USettings.gSettings.MEDIA_ROOT,OutputPath)
    if not OutputFile:#如果OutputFile为空说明传入的OutputPathFormat没有包含文件名，因此需要用默认的文件名
        OutputFile=USettings.UEditorSettings["defaultPathFormat"] % path_format_var
        OutputPathFormat=os.path.join(OutputPathFormat,OutputFile)
    if not os.path.exists(OutputPath):
        os.makedirs(OutputPath)
    return ( OutputPathFormat,OutputPath,OutputFile)
```
现在path_format的值为imagePathFormat，django中的request.GET.get()方法可以跟两个参数，如果get中可以取得第一个参数的值，则使用第一个的值，如果取不到，则使用第二个配置到的默认值。经过处理后OutputPathFormat的值为uploads/images。

接下来用os.path.split来将路径和文件名分割，然后分别赋值给OutputPath,OutputFile

下面就到了漏洞存在的地方了，往下看，下面会判断OutputFile是否为空，为空的话就用标准模板进行格式化，我们这里OutputFile显然为空，最终的文件名会返回一个格式化的名字，如下图
<div align="center">{% asset_img 5.jpg%}</div>
具体格式化方法如下：
```python
def get_path_format_vars():
    return {
        "year":datetime.datetime.now().strftime("%Y"),
        "month":datetime.datetime.now().strftime("%m"),
        "day":datetime.datetime.now().strftime("%d"),
        "date": datetime.datetime.now().strftime("%Y%m%d"),
        "time":datetime.datetime.now().strftime("%H%M%S"),
        "datetime":datetime.datetime.now().strftime("%Y%m%d%H%M%S"),
        "rnd":random.randrange(100,999)
    }
```
但是，如果我们构造的imagePathFormat参数中的值不是一个单纯的路径，而是一个包含文件名的参数呢？（如imagePathFormat = uploads%2Fimages%2Fhehehe.xxxx）
显而易见，OutputFile就是我们构造的hehehe.xxxx。
验证如下
<div align="center">{% asset_img 6.jpg%}</div>
经验证，写入的路径也是可以控制的，不仅限于images路径，并且可以覆盖其他的文件。
</br>
### 修补防御
可以通过修改代码，对用户上传的OutputFile类型进行过滤，只允许符合要求的类型进行上传。

