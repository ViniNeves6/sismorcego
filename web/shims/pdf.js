// react-native-pdf na web: exibe o PDF gerado num <iframe>.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native-web';
import { fileBytes } from './fs';

export default function Pdf({ source, style, onLoadComplete, onError }) {
  const url = useMemo(() => {
    const uri = decodeURI(source?.uri || '');
    if (uri.startsWith('data:')) return uri;
    const bytes = fileBytes(uri);
    return bytes ? URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) : null;
  }, [source?.uri]);
  useEffect(() => {
    if (!url) { onError?.(new Error('PDF indisponível.')); return undefined; }
    onLoadComplete?.(1, '');
    return () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={style}>
      {url ? <iframe title="Ficha em PDF" src={url} style={{ border: 0, width: '100%', height: '100%', background: '#fff' }} /> : null}
    </View>
  );
}
