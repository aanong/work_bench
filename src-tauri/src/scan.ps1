$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class ShellIcon {
 [StructLayout(LayoutKind.Sequential)] public struct Size { public int cx; public int cy; }
 [ComImport,Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface Factory { [PreserveSig] int GetImage(Size size,int flags,out IntPtr bitmap); }
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=true)] static extern int SHCreateItemFromParsingName(string path,IntPtr context,ref Guid iid,out Factory factory);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
 public static bool Save(string path,string output) {
  Factory factory=null;IntPtr bitmap=IntPtr.Zero;
  try { Guid iid=new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
   if(SHCreateItemFromParsingName(path,IntPtr.Zero,ref iid,out factory)!=0)return false;
   if(factory.GetImage(new Size { cx=256,cy=256 },4,out bitmap)!=0)return false;
   using(var image=Image.FromHbitmap(bitmap)) image.Save(output,ImageFormat.Png);
   return true;
  } catch { return false; } finally { if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(factory!=null)Marshal.ReleaseComObject(factory); }
 }
}
'@ -ReferencedAssemblies System.Drawing
$apps = @{}
$sha = [System.Security.Cryptography.SHA256]::Create()
$shell = New-Object -ComObject Shell.Application
$wsh = New-Object -ComObject WScript.Shell
$iconDir = $env:WORKBENCH_ICON_DIR
function Add-App($name,$launch,$kind,$identity,$exe,$iconSource) {
 if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($launch)) { return }
 if ($name -match '(?i)(\buninstall\b|\breadme\b|\buninstaller\b|卸载|自述|帮助文档)') { return }
 $id = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity.ToLowerInvariant())) | ForEach-Object { $_.ToString('x2') })
 if ($apps.ContainsKey($id)) { return }
 $iconPath = Join-Path $iconDir ($id + '.png')
 if (!(Test-Path -LiteralPath $iconPath)) {
  $ok = [ShellIcon]::Save($iconSource,$iconPath)
  if (!$ok -and $exe -and (Test-Path -LiteralPath $exe)) {
   try { $icon=[Drawing.Icon]::ExtractAssociatedIcon($exe);if($icon){$bitmap=$icon.ToBitmap();try{$bitmap.Save($iconPath,[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose();$icon.Dispose()}} } catch {}
  }
 }
 if (!(Test-Path -LiteralPath $iconPath)) { $iconPath=$null }
 $apps[$id]=@{id=$id;name=$name;target=$launch;kind=$kind;targetPath=$exe;iconPath=$iconPath;pinyin='';initials='';usage=0;lastUsed=0}
}
try {
 $folder=$shell.NameSpace('shell:AppsFolder')
 if ($null -eq $folder) { throw '无法读取 AppsFolder' }
 foreach ($item in $folder.Items()) {
  try {
   $aumid=[string]$item.ExtendedProperty('System.AppUserModel.ID')
   $exe=[string]$item.ExtendedProperty('System.Link.TargetParsingPath')
   $parse=[string]$item.Path
   if ($exe -and [IO.Path]::GetExtension($exe) -ieq '.exe' -and (Test-Path -LiteralPath $exe)) {
    # AppsFolder launch identity is kept even for Win32; shortcuts enrich it below.
    $launch=if($aumid){'shell:AppsFolder\'+$aumid}else{$exe}
    $identity=if($aumid){'aumid:'+$aumid}else{'exe:'+$exe+'|'}
    Add-App $item.Name $launch 'win32' $identity $exe $launch
   } elseif ($aumid -or $parse) {
    $key=if($aumid){$aumid}else{$parse}
    Add-App $item.Name ('shell:AppsFolder\'+$key) $(if($key.Contains('!')){'packaged'}else{'win32'}) ('aumid:'+$key) $null ('shell:AppsFolder\'+$key)
   }
  } catch { Write-Warning ('忽略损坏的应用条目：'+$item.Name) }
 }
 $roots=@([Environment]::GetFolderPath('CommonPrograms'),[Environment]::GetFolderPath('Programs'))
 foreach($root in $roots){if(!(Test-Path -LiteralPath $root)){continue};foreach($file in Get-ChildItem -LiteralPath $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue){
  try{
   $shortcut=$wsh.CreateShortcut($file.FullName);$exe=[string]$shortcut.TargetPath
   if(!$exe -or [IO.Path]::GetExtension($exe) -ine '.exe'){continue}
   $folderItem=$shell.NameSpace($file.DirectoryName).ParseName($file.Name)
   $aumid=[string]$folderItem.ExtendedProperty('System.AppUserModel.ID')
   $identity=if($aumid){'aumid:'+$aumid}else{'exe:'+$exe+'|'+$shortcut.Arguments}
   # Reuse the AppsFolder entry when exact AUMID or executable+arguments match.
   # Always launch the original .lnk, preserving arguments, working directory and elevation flags.
   $id=-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity.ToLowerInvariant())) | ForEach-Object {$_.ToString('x2')})
   if($apps.ContainsKey($id)){$apps[$id].target=$file.FullName;$apps[$id].targetPath=$exe;$apps[$id].kind='win32'}else{Add-App $file.BaseName $file.FullName 'win32' $identity $exe $file.FullName}
  }catch{Write-Warning ('忽略损坏的快捷方式：'+$file.Name)}
 }}
 $json=ConvertTo-Json -InputObject @($apps.Values) -Depth 5 -Compress
 [IO.File]::WriteAllText($env:WORKBENCH_SCAN_OUTPUT,$json,(New-Object Text.UTF8Encoding($false)))
} finally {
 $sha.Dispose()
 if($wsh){[void][Runtime.InteropServices.Marshal]::ReleaseComObject($wsh)}
 if($shell){[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)}
}
