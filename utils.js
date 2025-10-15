// Arquivo: utils.js (MODIFICADO E SIMPLIFICADO)

export const ligacoes = { Monofasico: [{value:'FN', text:'Fase-Neutro (FN)'}, {value:'FF', text:'Fase-Fase (FF)'}], Bifasico: [{value:'FF', text:'Fase-Fase (FF)'}, {value:'FFN', text:'Fase-Fase-Neutro (FFN)'}], Trifasico: [{value:'FFF', text:'Fase-Fase-Fase (FFF)'}, {value:'FFFN', text:'Fase-Fase-Fase-Neutro (FFFN)'}] };
export const BTU_TO_WATTS_FACTOR = 0.293071;
export const CV_TO_WATTS_FACTOR = 735.5;

// --- FUNÇÕES DE MÁSCARA ---
export function mascaraCPF(event){event.target.value=event.target.value.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2")}
export function mascaraCelular(event){event.target.value=event.target.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/g,'($1) $2').replace(/(\d{5})(\d{4})$/,'$1-$2')}
export function mascaraTelefone(event){event.target.value=event.target.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/g,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2')}
export function aplicarMascara(event, tipoDoc) { const doc = tipoDoc || document.getElementById('tipoDocumento').value; let value = event.target.value.replace(/\D/g,""); if(doc==='CPF'){value=value.slice(0,11).replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2")}else{value=value.slice(0,14).replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2')} event.target.value=value}
export function atualizarMascaraDocumento(){const tipoDoc=document.getElementById('tipoDocumento').value;const inputDoc=document.getElementById('documento');inputDoc.value='';if(tipoDoc==='CPF'){inputDoc.placeholder='000.000.000-00';inputDoc.maxLength=14}else{inputDoc.placeholder='00.000.000/0000-00';inputDoc.maxLength=18}}

// --- FUNÇÃO DEBOUNCE ---
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}