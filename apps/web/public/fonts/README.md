# ResumeFlow 字体资源

ResumeFlow 使用思源黑体、阿里巴巴普惠体、MiSans（小米）、HarmonyOS Sans（华为）、Inter 和苹方。字体资源的来源、版本与已有许可材料见下文。项目与字体权利方不存在合作、赞助或背书关系。

苹方从 macOS 的 TTC 字库中拆出完整简体中文字形，保存为独立 TTF；没有裁剪字符。其余字体文件保持下载时的原始字节，仅重命名文件。不进行动态裁剪。Web 预览与服务端 PDF 读取同一份资源。

| 字体               | 版本  | 来源                                                                                                                                                                                                                 | 许可                                         |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 思源黑体 SC        | 2.005 | [Adobe 官方 WOFF2](https://github.com/adobe-fonts/source-han-sans/tree/release/Variable/WOFF2/OTF)                                                                                                                   | [OFL 1.1](./LICENSE-SourceHanSans.txt)       |
| Inter              | 4.1   | [官方发布包](https://github.com/rsms/inter/releases/tag/v4.1)                                                                                                                                                        | [OFL 1.1](./LICENSE-Inter.txt)               |
| MiSans             | 4.009 | [小米官方字体包](https://hyperos.mi.com/font-download/MiSans.zip)，取包内原始 WOFF2                                                                                                                                  | [小米许可协议](./LICENSE-MiSans.pdf)         |
| HarmonyOS Sans SC  | 1.0   | [华为官方字体包](https://developer.huawei.com/images/download/general/HarmonyOS-Sans.zip)，取 SC 原始 TTF                                                                                                            | [华为许可协议](./LICENSE-HarmonyOS-Sans.txt) |
| 阿里巴巴普惠体 3.0 | 3.01  | 官方下载入口返回 403，使用 [npm 镜像包 @fontpkg/alibaba-pu-hui-ti-3-0@3.1.2](https://registry.npmjs.org/@fontpkg/alibaba-pu-hui-ti-3-0/-/alibaba-pu-hui-ti-3-0-3.1.2.tgz) 中的原始 TTF；已检查字体内嵌版本与版权信息 | [法律声明副本](./LICENSE-AlibabaPuHuiTi.txt) |

阿里普惠体官方入口：[字体官网](https://fonts.alibabagroup.com/)、[3.0 法律声明](https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy)。法律声明副本来自 [公开镜像](https://github.com/flyanx/html-poster-to-psd/blob/main/fonts/LICENSE-AlibabaPuHuiTi-3.0.md)，保留声明完整正文；正式使用以权利方条款为准。

苹方 SC 版本为 21.0d1e1，来源为本机 macOS Font8 MobileAsset 的 `PingFang.ttc`，包含 Regular（400）、Medium（500）和 Semibold（600）。使用项目内的独立 TTF 文件，浏览器与 Linux 导出器均不依赖系统字体安装。

## SHA-256

```text
d50f483fd8d9f95f9edbecdc199aee5fa9ddc5db8027f0d80334c3f502af61c8  alibaba-puhuiti-bold-d50f483f.ttf
be33bc8d45ced30fa5c542f6f056565baf85003d4e079522110d76016f8a04e2  alibaba-puhuiti-regular-be33bc8d.ttf
463818f16d73e8bca7c4a1478db0304bd0aaaaeb6c689476744d4713aa0bd7dc  alibaba-puhuiti-semibold-463818f1.ttf
43a424b85e47fb53a17b3b32026a71801f86f8e022ca6798d186b47d39fa5f01  harmonyos-sans-bold-43a424b8.ttf
6ed1553edccddc48eb27ff25d134a4a715cf54211238d4840b3038576cba1944  harmonyos-sans-medium-6ed1553e.ttf
297b088424be212207df2ce8b98e335468b782aa6b96832af0b8b773d711e2b1  harmonyos-sans-regular-297b0884.ttf
e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a  inter-italic-e564f652.woff2
693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3  inter-693b77d4.woff2
1c5a7515b61bc82baaa2e2c2fdae2032479fb9a99e09d4d021dc17314fc5939b  misans-bold-1c5a7515.woff2
d704c1a932c0bd7e8a071d276cd81c0ed0c9fecfa26ac234f4bed0559fe1cb2d  misans-regular-d704c1a9.woff2
78227c6ec59566785c65ac0b5312328bfa2f879918f3d7403725785615a9a8f6  misans-semibold-78227c6e.woff2
085cc88c530b9c434165ab926f81608a55b24e60e05719f3d41340ac45d9c62f  source-han-sans-085cc88c.woff2
adb6f724b84b906b91ceb1baca891bc986d0d70c75a88ca848df7686021ced01  pingfang-sc-regular-adb6f724.ttf
4dee5d9e07b9018ee16ed1a59478e37463c61d9586a1df2cb563391d8d91206d  pingfang-sc-medium-4dee5d9e.ttf
51df2eb769dcd1a541b245b3406cbca5851e832608bb234d6f9e3a8f338d0c6f  pingfang-sc-semibold-51df2eb7.ttf
```
