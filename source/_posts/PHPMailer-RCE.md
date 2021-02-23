---
title: PHPMailer漏洞分析
date: 2018-04-8 15:09:22
tags: web漏洞分析
categories: 技术

top_img: https://gingsguard.oss-cn-beijing.aliyuncs.com/blog/php.jpg
---

在PHPMailer 5.2.17以及之前版本中，存在着一个高危的任意文件写入漏洞，当攻击者将精心构造的恶意数据分别写入邮件内容以及发件人地址中并传递给使用了相应版本的PHPMailer web应用，就可以导致任意文件写入以及远程代码执行的攻击。<!--more-->

## 影响版本

[PHPMailer &lt; 5.2.18](http://www.baidu.com/link?url=um6oV6dGXX7qAxkU0jIKSwL3xMM0BpZpD_zFniLaJthbs_1A76kSswhsePrMssodFVaf0LrTQgKMY4_CvUV5QK)

## 漏洞分析

在正式的漏洞分析开始前，先来简单介绍下什么是phpmailer。

PHPMailer是一个用于发送电子邮件的php函数包。有的读者会提问，既然php本身提供了一个用于发送邮件的mail函数，通过这个函数可以直接在程序中发送邮件，那么为什么需要PHPMailer呢？

Mail函数的语法如下：mail(to,subject,message,headers,parameters)，可见mail函数没法指定一台中继邮件发送服务器（及下图step2中的MDA）的功能，Mail函数需要服务器支持sendmail邮件传输代理程序。除此之外mail()函数也存在着一些其他功能上的不足，因此功能更加强大的PHPMailer函数包便诞生了。

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP1-300x221.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP1.jpg)

对本次漏洞，先看一下官方有什么改动，可以通过改动来推断出漏洞存在的原因。

如下图所示，本次修复对class.phpmailer.php文件中的mailSend函数进行了改动，函数中的Sender参数进行了过滤。

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP2-300x86.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP2.jpg)

从上图可以看到，这个mailSend函数会将Sender参数处理后赋值给$params变量，当看到$params这个变量时，一些有经验的读者会想到mail函数第五个参数漏洞！的确没错，这个$params参数最终的确传给了mail函数，如下两张图所示。

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP3-300x297.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP3.jpg)

也就是说，我们可以通过控制Sender参数的传入，来构造$params参数，从而利用mail函数的一些特性写入后门文件。

既然我们已经确定Sender参数为罪魁祸首，接下来我们追踪如何从外部传入并且控制Sender参数，如下图所示，我们追踪到setFrom函数。在这里，$address的值被赋予$Sender。

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP4-300x190.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP4.jpg)

这里的$address就是PHPMailer所提供的用来接收邮件发送方地址的参数。在$address赋值给$Sender之前，需要经历一次过滤，如下图所示

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP5-300x121.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP5.jpg)

如上图所示，不能让红色框里的if语句判定成立，如果成立了，直接return false了，if条件的结构可以简化为(a or (b or c) and d)，在这里我们要确保$this-&gt;validateAddress($address)为真，才可以避免return false的结局，接下来看一下$this-&gt;validateAddress($address)中的代码。

<pre class="lang:default decode:true ">public static function validateAddress($address, $patternselect = null)
{
    if (is_null($patternselect)) {
        $patternselect = self::$validator;
    }
    if (is_callable($patternselect)) {
        return call_user_func($patternselect, $address);
    }
    //Reject line breaks in addresses; it's valid RFC5322, but not RFC5321
    if (strpos($address, "\n") !== false or strpos($address, "\r") !== false) {
        return false;
    }
    if (!$patternselect or $patternselect == 'auto') {
        //Check this constant first so it works when extension_loaded() is disabled by safe mode
        //Constant was added in PHP 5.2.4
        if (defined('PCRE_VERSION')) {
            //This pattern can get stuck in a recursive loop in PCRE &lt;= 8.0.2
            if (version_compare(PCRE_VERSION, '8.0.3') &gt;= 0) {
                $patternselect = 'pcre8';
            } else {
                $patternselect = 'pcre';
            }
        } elseif (function_exists('extension_loaded') and extension_loaded('pcre')) {
            //Fall back to older PCRE
            $patternselect = 'pcre';
        } else {
            //Filter_var appeared in PHP 5.2.0 and does not require the PCRE extension
            if (version_compare(PHP_VERSION, '5.2.0') &gt;= 0) {
                $patternselect = 'php';
            } else {
                $patternselect = 'noregex';
            }
        }
    }
    switch ($patternselect) {
        case 'pcre8':
            /**
             * Uses the same RFC5322 regex on which FILTER_VALIDATE_EMAIL is based, but allows dotless domains.
             * @link http://squiloople.com/2009/12/20/email-address-validation/
             * @copyright 2009-2010 Michael Rushton
             * Feel free to use and redistribute this code. But please keep this copyright notice.
             */
            return (boolean)preg_match(
                '/^(?!(?&gt;(?1)"?(?&gt;\\\[ -~]|[^"])"?(?1)){255,})(?!(?&gt;(?1)"?(?&gt;\\\[ -~]|[^"])"?(?1)){65,}@)' .
                '((?&gt;(?&gt;(?&gt;((?&gt;(?&gt;(?&gt;\x0D\x0A)?[\t ])+|(?&gt;[\t ]*\x0D\x0A)?[\t ]+)?)(\((?&gt;(?2)' .
                '(?&gt;[\x01-\x08\x0B\x0C\x0E-\'*-\[\]-\x7F]|\\\[\x00-\x7F]|(?3)))*(?2)\)))+(?2))|(?2))?)' .
                '([!#-\'*+\/-9=?^-~-]+|"(?&gt;(?2)(?&gt;[\x01-\x08\x0B\x0C\x0E-!#-\[\]-\x7F]|\\\[\x00-\x7F]))*' .
                '(?2)")(?&gt;(?1)\.(?1)(?4))*(?1)@(?!(?1)[a-z0-9-]{64,})(?1)(?&gt;([a-z0-9](?&gt;[a-z0-9-]*[a-z0-9])?)' .
                '(?&gt;(?1)\.(?!(?1)[a-z0-9-]{64,})(?1)(?5)){0,126}|\[(?:(?&gt;IPv6:(?&gt;([a-f0-9]{1,4})(?&gt;:(?6)){7}' .
                '|(?!(?:.*[a-f0-9][:\]]){8,})((?6)(?&gt;:(?6)){0,6})?::(?7)?))|(?&gt;(?&gt;IPv6:(?&gt;(?6)(?&gt;:(?6)){5}:' .
                '|(?!(?:.*[a-f0-9]:){6,})(?8)?::(?&gt;((?6)(?&gt;:(?6)){0,4}):)?))?(25[0-5]|2[0-4][0-9]|1[0-9]{2}' .
                '|[1-9]?[0-9])(?&gt;\.(?9)){3}))\])(?1)$/isD',
                $address
            );
        case 'pcre':
            //An older regex that doesn't need a recent PCRE
            return (boolean)preg_match(
                '/^(?!(?&gt;"?(?&gt;\\\[ -~]|[^"])"?){255,})(?!(?&gt;"?(?&gt;\\\[ -~]|[^"])"?){65,}@)(?&gt;' .
                '[!#-\'*+\/-9=?^-~-]+|"(?&gt;(?&gt;[\x01-\x08\x0B\x0C\x0E-!#-\[\]-\x7F]|\\\[\x00-\xFF]))*")' .
                '(?&gt;\.(?&gt;[!#-\'*+\/-9=?^-~-]+|"(?&gt;(?&gt;[\x01-\x08\x0B\x0C\x0E-!#-\[\]-\x7F]|\\\[\x00-\xFF]))*"))*' .
                '@(?&gt;(?![a-z0-9-]{64,})(?&gt;[a-z0-9](?&gt;[a-z0-9-]*[a-z0-9])?)(?&gt;\.(?![a-z0-9-]{64,})' .
                '(?&gt;[a-z0-9](?&gt;[a-z0-9-]*[a-z0-9])?)){0,126}|\[(?:(?&gt;IPv6:(?&gt;(?&gt;[a-f0-9]{1,4})(?&gt;:' .
                '[a-f0-9]{1,4}){7}|(?!(?:.*[a-f0-9][:\]]){8,})(?&gt;[a-f0-9]{1,4}(?&gt;:[a-f0-9]{1,4}){0,6})?' .
                '::(?&gt;[a-f0-9]{1,4}(?&gt;:[a-f0-9]{1,4}){0,6})?))|(?&gt;(?&gt;IPv6:(?&gt;[a-f0-9]{1,4}(?&gt;:' .
                '[a-f0-9]{1,4}){5}:|(?!(?:.*[a-f0-9]:){6,})(?&gt;[a-f0-9]{1,4}(?&gt;:[a-f0-9]{1,4}){0,4})?' .
                '::(?&gt;(?:[a-f0-9]{1,4}(?&gt;:[a-f0-9]{1,4}){0,4}):)?))?(?&gt;25[0-5]|2[0-4][0-9]|1[0-9]{2}' .
                '|[1-9]?[0-9])(?&gt;\.(?&gt;25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}))\])$/isD',
                $address
            );
        case 'html5':
            /**
             * This is the pattern used in the HTML5 spec for validation of 'email' type form input elements.
             * @link http://www.whatwg.org/specs/web-apps/current-work/#e-mail-state-(type=email)
             */
            return (boolean)preg_match(
                '/^[a-zA-Z0-9.!#$%&amp;\'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}' .
                '[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/sD',
                $address
            );
        case 'noregex':
            //No PCRE! Do something _very_ approximate!
            //Check the address is 3 chars or longer and contains an @ that's not the first or last char
            return (strlen($address) &gt;= 3
                and strpos($address, '@') &gt;= 1
                and strpos($address, '@') != strlen($address) - 1);
        case 'php':
        default:
            return (boolean)filter_var($address, FILTER_VALIDATE_EMAIL);
    }
}
</pre>

现在大多都采取'pcre8'方式进行过滤，所以我们的$address必须成功的通过过滤才可以赋值给$this-&gt;Sender.。

目前已经有研究员构造出可以通过正则过滤的$address结构

<pre class="lang:default decode:true ">xxx( -X/var/www/test.php )@qq.com</pre>

这种结构的$address可以顺利的绕过pcre8正则的检测，接着在程序调用mail发送邮件时，$params参数成功的被拼接成“-fxxx( -X/var/www/success.php )@qq.com”作为额外参数传递给sendmail。在sendmail参数中 –X参数的作用是指定写入log的文件路径，具体描述如下图所示。

[![](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP6-300x43.jpg)](http://blog.nsfocus.net/wp-content/uploads/2017/01/PHP6.jpg)

## 漏洞利用

漏洞利用的前提是目标站点的web应用必须使用phpmailer函数包，并开启邮件发送功能，这时攻击者可以将构造好的$address（及发送者地址）填入相应表单位置，然后将php指令填写到邮件内容中，如果web应用没有相应的过滤，则可以成功触发phpmailer，将php代码作为日志写入指定的文件中去。

## 修补防御

升级phpmailer至最新版本。

如果您需要了解更多内容，可以
加入QQ群：570982169
直接询问：010-68438880