import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

const OBJETIVOS  = ['Emagrecimento', 'Hipertrofia', 'Reeducação alimentar', 'Saúde geral', 'Performance esportiva'];
const PLANOS     = [
  { v: 'avulso',     l: 'Avulso' },
  { v: 'trimestral', l: 'Trimestral' },
  { v: 'semestral',  l: 'Semestral' },
];
const MODALIDADES = ['Presencial', 'Online'];

const FORM_VAZIO = {
  nome: '', email: '', nascimento: '',
  objetivo: 'Emagrecimento', tipoPlano: 'trimestral',
  valorPlano: '', modalidade: 'Online', obs: '',
};

export default function Cadastrar() {
  const { user } = useSession();

  const [form, setForm]       = useState(FORM_VAZIO);
  const [busy, setBusy]       = useState(false);
  const [erro, setErro]       = useState(null);
  const [sucesso, setSucesso] = useState(null);   // { nome, email }
  const [recentes, setRecentes] = useState([]);

  function set(campo) {
    return v => setForm(f => ({ ...f, [campo]: v }));
  }

  async function carregarRecentes() {
    if (!user) return;
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, email, objetivo, tipo_plano, modalidade, created_at')
      .eq('nutri_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    setRecentes(data ?? []);
  }

  useEffect(() => { carregarRecentes(); }, [user]);

  function resetForm() {
    setForm(FORM_VAZIO);
  }

  async function salvar(e) {
    e?.preventDefault?.();
    setErro(null); setSucesso(null);
    if (!form.nome.trim())  return setErro('Informe o nome.');
    if (!form.email.trim()) return setErro('Informe o email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErro('Email inválido.');

    setBusy(true);
    const { data, error } = await supabase.rpc('cadastrar_paciente_direto', {
      p_nome:       form.nome.trim(),
      p_email:      form.email.trim().toLowerCase(),
      p_nascimento: form.nascimento || null,
      p_objetivo:   form.objetivo,
      p_tipo_plano: form.tipoPlano,
      p_modalidade: form.modalidade,
      p_obs:        form.obs.trim() || null,
    });

    if (error) { setBusy(false); return setErro(error.message); }

    // Salva valor e cria contrato pendente (paciente aceita no primeiro acesso)
    const pacienteId = data?.id;
    const valor = parseFloat(String(form.valorPlano).replace(',', '.')) || null;
    if (pacienteId && valor && ['avulso', 'trimestral', 'semestral'].includes(form.tipoPlano)) {
      await Promise.all([
        supabase.from('pacientes').update({ valor_plano: valor }).eq('id', pacienteId),
        supabase.from('contratos_pacientes').insert({
          paciente_id: pacienteId,
          nutri_id:    user.id,
          tipo_plano:  form.tipoPlano,
          valor,
          data_inicio: new Date().toISOString().slice(0, 10),
          aceito:      false,
        }),
      ]);
    }

    setBusy(false);
    setSucesso({ nome: form.nome.trim(), email: form.email.trim().toLowerCase() });
    resetForm();
    carregarRecentes();
  }

  function mensagemWhats(nome, email) {
    const primeiroNome = nome.split(' ')[0];
    const url = window.location.origin;
    return encodeURIComponent(
      `Oi ${primeiroNome}! 😊\n\nSeu perfil no app de acompanhamento nutricional já está pronto!\n\n` +
      `📱 Acesse: ${url}\n` +
      `📧 Email: ${email}\n` +
      `🔑 Senha inicial: 123456\n\n` +
      `Assim que entrar, recomendo trocar a senha em Mais → Alterar senha 🔒\n\nQualquer dúvida, me chama!`
    );
  }

  return (
    <>
      <div className="page-title">Cadastrar paciente</div>
      <div className="page-sub">Preencha os dados — a conta é criada com a senha inicial <strong>123456</strong>. A paciente acessa direto e pode trocar a senha quando quiser.</div>

      <div className="cadastrar-grid">

        {/* ─── Formulário ─── */}
        <form onSubmit={salvar} className="card cadastrar-form" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Novo cadastro</div>

          <Field label="Nome completo *" value={form.nome} onChange={set('nome')} required autoFocus />
          <div className="cadastrar-campos-row">
            <Field label="Email *" type="email" value={form.email} onChange={set('email')} required />
            <Field label="Data de nascimento" type="date" value={form.nascimento} onChange={set('nascimento')} />
          </div>

          <SelectField label="Objetivo" value={form.objetivo} onChange={set('objetivo')} options={OBJETIVOS} />
          <div className="cadastrar-plano-row">
            <SelectField label="Tipo de plano" value={form.tipoPlano} onChange={set('tipoPlano')} options={PLANOS} />
            <Field label="Valor do plano (R$)" inputMode="decimal" placeholder="ex: 350,00" value={form.valorPlano} onChange={set('valorPlano')} />
            <SelectField label="Modalidade de atendimento" value={form.modalidade} onChange={set('modalidade')} options={MODALIDADES} />
          </div>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 11, color: '#555555', marginBottom: 5, fontWeight: 500 }}>
              Observação (opcional)
            </span>
            <textarea value={form.obs} onChange={e => set('obs')(e.target.value)} rows={2}
              placeholder="Ex: indicada pela Camila, pós-operatório..."
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13,
                border: '0.5px solid var(--border)', borderRadius: 8,
                outline: 'none', fontFamily: 'var(--font-sans)',
                resize: 'vertical', boxSizing: 'border-box',
              }} />
          </label>

          {erro && (
            <div style={{
              fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 10,
              background: 'var(--red-soft)', color: 'var(--red)',
            }}>{erro}</div>
          )}

          <button type="submit" className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            <i className="ti ti-user-plus" aria-hidden="true"></i>
            {busy ? 'Cadastrando...' : 'Cadastrar paciente'}
          </button>
        </form>

        {/* ─── Info card ─── */}
        <div className="cadastrar-info">
          {sucesso ? (
            <CartaoSucesso
              nome={sucesso.nome}
              email={sucesso.email}
              mensagemWhats={mensagemWhats(sucesso.nome, sucesso.email)}
              onDispensar={() => setSucesso(null)}
            />
          ) : (
            <div className="al-b" style={{ marginBottom: 12 }}>
              <i className="ti ti-info-circle" style={{ fontSize: 16, color: 'var(--blue)', marginTop: 1 }} aria-hidden="true"></i>
              <div>
                <div className="al-t" style={{ color: 'var(--blue)' }}>Como funciona</div>
                <div className="al-d">
                  Você preenche os dados e a conta é criada na hora com a senha padrão <strong>123456</strong>.
                  A paciente acessa direto com o email dela + essa senha. Depois do primeiro acesso, ela pode trocar em <em>Mais → Alterar senha</em>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Pacientes recentemente cadastradas ─── */}
        <div className="cadastrar-recentes">
          {recentes.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 4 }}>
                Cadastradas recentemente
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {recentes.map(p => (
                  <div key={p.id} className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: '#555555' }}>
                      {p.email} · cadastrada em {dataBR(p.created_at)}
                    </div>
                    <div style={{ fontSize: 10, color: '#555555', marginTop: 2 }}>
                      {[p.objetivo, p.tipo_plano, p.modalidade].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}


function CartaoSucesso({ nome, email, mensagemWhats, onDispensar }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: 'var(--green-soft, #ecfdf5)',
      border: '0.5px solid var(--green, #10b981)',
      borderLeft: '3px solid var(--green, #10b981)',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green, #10b981)', marginBottom: 4 }}>
            ✓ {nome.split(' ')[0]} cadastrada!
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Conta criada com senha inicial <strong>123456</strong>. Para acessar, ela usa o email abaixo + essa senha (pode trocar depois em Mais → Alterar senha):
          </div>
        </div>
        <button onClick={onDispensar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555555', padding: 0 }}>
          <i className="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>

      <div style={{
        margin: '10px 0', padding: '8px 10px',
        background: 'var(--white)', borderRadius: 6,
        fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-soft)',
        wordBreak: 'break-all',
      }}>{email}</div>

      <a
        href={`https://wa.me/?text=${mensagemWhats}`}
        target="_blank" rel="noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
          background: '#25d366', color: '#fff',
          fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
        }}>
        <i className="ti ti-brand-whatsapp" aria-hidden="true"></i>
        Avisar pelo WhatsApp
      </a>
    </div>
  );
}


function Field({ label, value, onChange, type = 'text', inputMode, placeholder, required, autoFocus }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, color: '#555555', marginBottom: 5, fontWeight: 500 }}>
        {label}
      </span>
      <input
        type={type} value={value} inputMode={inputMode} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        required={required} autoFocus={autoFocus}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13,
          border: '0.5px solid var(--border)', borderRadius: 8,
          outline: 'none', fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  const opts = options.map(o => typeof o === 'string' ? { v: o, l: o } : o);
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, color: '#555555', marginBottom: 5, fontWeight: 500 }}>
        {label}
      </span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13,
          border: '0.5px solid var(--border)', borderRadius: 8,
          outline: 'none', fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
