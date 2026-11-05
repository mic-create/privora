export function initModalComponent() {
    const modalContainer = document.getElementById('modal-container');
    
    window.showModal = function(contentHtml) {
        modalContainer.innerHTML = `
            <div class="bg-navy-900 border border-navy-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fade-in">
                <button id="modal-close" class="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                ${contentHtml}
            </div>
        `;
        modalContainer.classList.remove('hidden');
        modalContainer.classList.add('flex');

        modalContainer.querySelector('#modal-close').onclick = window.hideModal;
        modalContainer.onclick = (e) => {
            if (e.target === modalContainer) window.hideModal();
        };
    };

    window.hideModal = function() {
        modalContainer.classList.add('hidden');
        modalContainer.classList.remove('flex');
        modalContainer.innerHTML = '';
    };
}