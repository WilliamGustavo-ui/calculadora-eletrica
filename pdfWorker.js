import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

self.onmessage = async (e) => {
    const { formData, SUPABASE_URL, SUPABASE_ANON_KEY, authHeader } = e.data;

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: pdfBlob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData },
            responseType: 'blob'
        });

        if (error) throw error;

        self.postMessage({ success: true, pdfBlob, obra: formData.mainData?.obra });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};