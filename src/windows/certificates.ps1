$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
    Add-Type -AssemblyName System.Security
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $store = [System.Security.Cryptography.X509Certificates.X509Store]::new([System.Security.Cryptography.X509Certificates.StoreName]::My, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    try {
        $now = Get-Date
        if ($request.action -eq 'list') {
            $items = @($store.Certificates | Where-Object { $_.HasPrivateKey -and $_.NotBefore -le $now -and $_.NotAfter -gt $now } | ForEach-Object {
                @{ thumbprint = $_.Thumbprint; subject = $_.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false); expiresAt = $_.NotAfter.ToUniversalTime().ToString('o') }
            })
            @{ certificates = $items } | ConvertTo-Json -Compress -Depth 4
        } elseif ($request.action -eq 'sign') {
            if ($request.thumbprint -notmatch '^[a-fA-F0-9]{40}$') { throw 'Identificador de certificado invalido.' }
            $selectedCertificates = $store.Certificates.Find([System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $request.thumbprint, $false)
            if ($selectedCertificates.Count -ne 1) { throw 'Certificado nao encontrado. Conecte o token e confira o driver.' }
            $cert = $selectedCertificates[0]
            if (!$cert.HasPrivateKey -or $cert.NotBefore -gt $now -or $cert.NotAfter -le $now) { throw 'Certificado indisponivel ou fora da validade.' }
            $bytes = [Convert]::FromBase64String($request.content)
            $content = [System.Security.Cryptography.Pkcs.ContentInfo]::new($bytes)
            $cms = [System.Security.Cryptography.Pkcs.SignedCms]::new($content, $true)
            $signer = [System.Security.Cryptography.Pkcs.CmsSigner]::new($cert)
            $signer.DigestAlgorithm = [System.Security.Cryptography.Oid]::new('2.16.840.1.101.3.4.2.1')
            $signer.IncludeOption = [System.Security.Cryptography.X509Certificates.X509IncludeOption]::ExcludeRoot
            # The key stays with Windows/the token. The provider displays its PIN UI if necessary.
            $cms.ComputeSignature($signer, $false)
            $cms.CheckSignature($true)
            @{ signature = [Convert]::ToBase64String($cms.Encode()) } | ConvertTo-Json -Compress
        } else { throw 'Operacao de certificado invalida.' }
    } finally { $store.Close() }
} catch {
    @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
