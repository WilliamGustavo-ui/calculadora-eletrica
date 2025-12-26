// Arquivo: pdfWorker.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

self.onmessage = async (e) => {
    const { formData, SUPABASE_URL, SUPABASE_ANON_KEY, authHeader } = e.data;

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        // Chama a Edge Function [cite: 201]
        const { data: pdfBlob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData },
            responseType: 'blob'
        });

        if (error) throw error;

        // Devolve o Blob para a main thread
        self.postMessage({ success: true, pdfBlob });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};