/*
 * booking.js — Modal calificador de 5 pasos (lead scoring) reutilizable.
 *
 * Restricción de marca: al completar los 5 pasos redirige a Calendly. El flujo
 * y la URL NO se alteran. El markup se inyecta en <div id="site-booking"></div>.
 *
 * Expone en window: openBooking(), closeBooking(), nextStep(n), submitBooking().
 */
(function () {
  'use strict';

  var calendlyBookingUrl = 'https://calendly.com/martynduarte/sample-30min';
  var lastFocus = null;

  var qualifierConfig = {
    assessment: {
      step3Question: '¿Cuál es el volumen aproximado de datos que gestiona actualmente?',
      step3Field: '<select class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm"><option>&lt; 1 TB</option><option>1 - 100 TB</option><option>100 TB - 1 PB</option><option>&gt; 1 PB</option></select>',
      step4Question: '¿Qué stack cloud o analítico utiliza hoy?',
      step4Field: '<div class="grid grid-cols-2 gap-4"><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="checkbox"> AWS</label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="checkbox"> Azure</label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="checkbox"> Databricks</label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="checkbox"> On-Premise</label></div>',
      step5Question: '¿Qué urgencia tiene el assessment?',
      step5Field: ['Inmediato', '30-60 días', 'Planificación trimestral']
    },
    modernization: {
      step3Question: '¿Cuál es la plataforma origen que desean modernizar?',
      step3Field: '<input type="text" placeholder="Ej: SQL Server, SAP BW, Hadoop, on-prem legacy" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm">',
      step4Question: '¿Cuál es el plazo deseado para iniciar la modernización?',
      step4Field: '<div class="grid grid-cols-1 gap-3"><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="timeline" class="accent-blue-600"> <span class="text-sm font-medium">0-3 meses</span></label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="timeline" class="accent-blue-600"> <span class="text-sm font-medium">3-6 meses</span></label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="timeline" class="accent-blue-600"> <span class="text-sm font-medium">6-12 meses</span></label></div>',
      step5Question: '¿Cuál es el nivel de presión del programa?',
      step5Field: ['Programa crítico', 'Roadmap activo', 'Exploración 2026']
    },
    fractional: {
      step3Question: '¿De qué tamaño es hoy el equipo involucrado?',
      step3Field: '<select class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm"><option>1-3 personas</option><option>4-8 personas</option><option>9-20 personas</option><option>20+ personas</option></select>',
      step4Question: '¿Cuál es el principal dolor operativo que quieren resolver?',
      step4Field: '<div class="grid grid-cols-1 gap-3"><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="pain" class="accent-blue-600"> <span class="text-sm font-medium">Decisiones técnicas inconsistentes</span></label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="pain" class="accent-blue-600"> <span class="text-sm font-medium">Falta de seniority arquitectónico</span></label><label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer"><input type="radio" name="pain" class="accent-blue-600"> <span class="text-sm font-medium">Roadmap sin governance</span></label></div>',
      step5Question: '¿Cómo imaginan el esquema de acompañamiento?',
      step5Field: ['Semanal', 'Quincenal', 'Mensual']
    },
    default: {
      step3Question: '¿Qué objetivo de negocio quieren acelerar con este servicio?',
      step3Field: '<input type="text" placeholder="Ej: rentabilidad, time-to-market, gobierno, escalabilidad" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm">',
      step4Question: '¿Qué restricción técnica pesa más hoy?',
      step4Field: '<input type="text" placeholder="Ej: costo, legacy, talento, calidad de datos" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm">',
      step5Question: '¿Cuál es la ventana ideal para avanzar?',
      step5Field: ['Ahora', 'Próximo trimestre', 'Segundo semestre']
    }
  };

  function stepIndicators(active) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<div class="step-indicator' + (i <= active ? ' active' : '') + '"></div>';
    }
    return '<div class="flex gap-4 mb-8">' + out + '</div>';
  }

  function renderBookingModal() {
    return '' +
    '<div id="bookingModal" class="fixed inset-0 z-[60] flex items-center justify-center p-6 hidden" role="dialog" aria-modal="true" aria-labelledby="bookingTitle">' +
      '<div class="absolute inset-0 modal-overlay" onclick="closeBooking()"></div>' +
      '<div class="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden">' +
        '<div class="p-10">' +
          '<div class="flex justify-between items-center mb-10">' +
            '<h3 id="bookingTitle" class="text-2xl font-black uppercase tracking-tighter">Agendar reunión</h3>' +
            '<button type="button" onclick="closeBooking()" aria-label="Cerrar" class="text-slate-400 hover:text-slate-900 text-2xl font-bold leading-none">×</button>' +
          '</div>' +
          '<div id="formSteps">' +
            '<div id="step-1" class="space-y-6">' + stepIndicators(1) +
              '<input type="text" placeholder="Nombre" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-sm outline-none focus:border-blue-600">' +
              '<input type="email" placeholder="Correo Electrónico" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-sm outline-none focus:border-blue-600">' +
              '<input type="text" placeholder="País" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-sm outline-none focus:border-blue-600">' +
              '<input type="text" placeholder="Empresa (Opcional)" class="p-4 bg-slate-50 border border-slate-100 rounded-2xl w-full text-sm outline-none focus:border-blue-600">' +
              '<button type="button" onclick="nextStep(2)" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold mt-4">Continuar</button>' +
            '</div>' +
            '<div id="step-2" class="hidden space-y-6">' + stepIndicators(2) +
              '<h4 class="font-bold text-slate-800">¿Sobre qué servicio quieres contactarte?</h4>' +
              '<div class="grid grid-cols-1 gap-2">' +
                '<p class="text-[9px] font-black uppercase tracking-widest text-blue-600 px-1">Data</p>' +
                serviceOption('assessment', 'Diagnóstico de Arquitectura de Datos') +
                serviceOption('blueprint', 'Blueprint de Arquitectura Empresarial') +
                serviceOption('strategy', 'Estrategia de Migración de Datos') +
                serviceOption('modernization', 'Modernización de Plataforma') +
                serviceOption('fractional', 'Arquitecto de Datos por Horas') +
                '<p class="text-[9px] font-black uppercase tracking-widest text-blue-600 px-1 pt-2">Otros pilares</p>' +
                serviceOption('ia', 'Inteligencia Artificial (mentoría / formación)') +
                serviceOption('automatizaciones', 'Automatizaciones / Agentes de IA') +
                serviceOption('ecommerce', 'Tienda Nube (E-Commerce)') +
                serviceOption('desarrollo', 'Desarrollo Web') +
              '</div>' +
              '<button type="button" onclick="nextStep(3)" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold mt-4">Siguiente Pregunta</button>' +
            '</div>' +
            '<div id="step-3" class="hidden space-y-6">' + stepIndicators(3) +
              '<h4 id="step3Question" class="font-bold text-slate-800"></h4><div id="step3Field"></div>' +
              '<button type="button" onclick="nextStep(4)" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold mt-4">Siguiente</button>' +
            '</div>' +
            '<div id="step-4" class="hidden space-y-6">' + stepIndicators(4) +
              '<h4 id="step4Question" class="font-bold text-slate-800"></h4><div id="step4Field"></div>' +
              '<button type="button" onclick="nextStep(5)" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold mt-4">Siguiente</button>' +
            '</div>' +
            '<div id="step-5" class="hidden space-y-6 text-center">' + stepIndicators(5) +
              '<h4 id="step5Question" class="font-bold text-slate-800"></h4><div id="step5Field" class="flex gap-4"></div>' +
              '<button type="button" onclick="submitBooking()" data-ev="submit_calificador" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-black mt-8 shadow-xl shadow-blue-200">Confirmar Solicitud ➔</button>' +
            '</div>' +
            '<div id="step-final" class="hidden text-center py-10 space-y-6">' +
              '<div class="text-5xl" aria-hidden="true">✅</div>' +
              '<h3 class="text-2xl font-black">Solicitud Recibida</h3>' +
              '<p class="text-slate-500 text-sm">Redirigiendo a Calendly para que puedas elegir tu horario.</p>' +
              '<button type="button" onclick="closeBooking()" class="px-8 py-3 bg-slate-100 text-slate-900 rounded-full font-bold">Cerrar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function serviceOption(value, label) {
    return '<label class="qualifier-option p-4 border border-slate-100 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-blue-50">' +
      '<input type="radio" name="service" value="' + value + '" class="accent-blue-600">' +
      '<span class="text-sm font-medium">' + label + '</span></label>';
  }

  function getSelectedService() {
    var el = document.querySelector('input[name="service"]:checked');
    return el ? el.value : 'default';
  }

  function renderQualifierStep(step) {
    var config = qualifierConfig[getSelectedService()] || qualifierConfig.default;
    document.getElementById('step' + step + 'Question').textContent = config['step' + step + 'Question'];
    var target = document.getElementById('step' + step + 'Field');
    var field = config['step' + step + 'Field'];
    if (Array.isArray(field)) {
      target.innerHTML = field.map(function (label) {
        return '<button type="button" class="flex-1 py-4 border border-slate-200 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-colors">' + label + '</button>';
      }).join('');
    } else {
      target.innerHTML = field;
    }
  }

  window.openBooking = function () {
    lastFocus = document.activeElement;
    document.getElementById('bookingModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderQualifierStep(3);
    renderQualifierStep(4);
    renderQualifierStep(5);
  };

  window.closeBooking = function () {
    document.getElementById('bookingModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    for (var i = 1; i <= 5; i++) document.getElementById('step-' + i).classList.add('hidden');
    document.getElementById('step-final').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  window.nextStep = function (step) {
    if (step >= 3) renderQualifierStep(step);
    document.getElementById('step-' + (step - 1)).classList.add('hidden');
    document.getElementById('step-' + step).classList.remove('hidden');
  };

  window.submitBooking = function () {
    document.getElementById('step-5').classList.add('hidden');
    document.getElementById('step-final').classList.remove('hidden');
    window.setTimeout(function () { window.location.href = calendlyBookingUrl; }, 1200);
  };

  // Cerrar con Esc (mejora de accesibilidad; el foco vuelve al disparador)
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('bookingModal');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      window.closeBooking();
    }
  });

  function injectStyles() {
    if (document.getElementById('booking-styles')) return;
    var css =
      '.modal-overlay{background:rgba(15,23,42,.9);backdrop-filter:blur(8px)}' +
      '.step-indicator{height:4px;background:#E2E8F0;flex-grow:1;border-radius:2px}' +
      '.step-indicator.active{background:#2563EB}' +
      '.qualifier-option:has(input:checked){border-color:#2563EB;background:rgba(37,99,235,.06)}';
    var s = document.createElement('style');
    s.id = 'booking-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    var host = document.getElementById('site-booking');
    if (host) host.innerHTML = renderBookingModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
