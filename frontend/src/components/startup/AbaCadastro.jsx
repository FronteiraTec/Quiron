/**
 * A aba "Cadastro": tudo que o formulario gravou, em modo leitura.
 *
 * Existe porque o cadastro deixou de caber no cabecalho. Nome, CNPJ e status
 * continuam la em cima — sao a identidade da startup —, mas inscricao estadual,
 * contatos, endereco, campos personalizaveis e observacoes precisam de um lugar
 * onde possam ser lidos sem abrir o formulario de edicao.
 *
 * NAO REPETE o que o cabecalho ja mostra. Um dado desenhado duas vezes na mesma
 * tela e um dado que vai divergir na primeira mudanca.
 *
 * Recebe a startup ja carregada pelo pai (GET /startups/:id devolve os contatos
 * junto), entao nao busca nada.
 */
import { Box, Typography, Grid, Divider, Chip, Link } from "@mui/material"
import { Person, Email, Phone, LocationOn, Notes } from "@mui/icons-material"
import { useStartupConfigStore } from "../../store/startupConfigStore"
import { formatarCnpj, formatarCep, formatarCelular } from "../../utils/mascaras"
import { formatarCampoExtra } from "../../utils/camposExtras"

/** Um par rotulo/valor. Valor ausente vira travessao, e nao some: a lacuna informa. */
function Dado({ rotulo, valor, children, xs = 12, sm = 6 }) {
  return (
    <Grid item xs={xs} sm={sm}>
      <Typography variant="caption" color="text.secondary" display="block">
        {rotulo}
      </Typography>
      {children || (
        <Typography variant="body2" fontWeight={valor ? 500 : 400} color={valor ? "text.primary" : "text.disabled"}>
          {valor || "—"}
        </Typography>
      )}
    </Grid>
  )
}

function Secao({ icone, titulo, children }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        {icone}
        <Typography variant="subtitle2" fontWeight={700}>
          {titulo}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}

export default function AbaCadastro({ startup }) {
  const campos = useStartupConfigStore((s) => s.campos) || []
  const contatos = startup.contatos || []
  const extras = startup.campos_extras || {}

  const enderecoLinha1 = [startup.rua, startup.numero].filter(Boolean).join(", ")
  const enderecoLinha2 = [startup.bairro, startup.cidade, startup.uf].filter(Boolean).join(" · ")
  const temEndereco = Boolean(startup.cep || enderecoLinha1 || enderecoLinha2)

  // Só os campos que a startup respondeu. Listar os vazios encheria a tela de
  // travessoes — quem quer preencher abre o formulario, que mostra todos.
  const extrasPreenchidos = campos
    .map((campo) => ({ campo, texto: formatarCampoExtra(campo, extras[campo.chave]) }))
    .filter((item) => item.texto !== null)

  return (
    <Box>
      <Secao icone={<Person fontSize="small" color="primary" />} titulo="Identificação">
        <Grid container spacing={2.5}>
          <Dado rotulo="CNPJ" valor={formatarCnpj(startup.cnpj)} sm={4} />
          <Dado rotulo="Inscrição estadual" valor={startup.inscricao_estadual} sm={4} />
          <Dado rotulo="Tipo" sm={4}>
            {startup.tipo_rotulo ? (
              <Chip
                size="small"
                label={startup.tipo_rotulo}
                variant="outlined"
                sx={{ borderColor: startup.tipo_cor, color: startup.tipo_cor, mt: 0.25 }}
              />
            ) : (
              <Typography variant="body2" color="text.disabled">
                —
              </Typography>
            )}
          </Dado>
          <Dado rotulo="E-mail" sm={12}>
            {startup.email ? (
              <Link href={`mailto:${startup.email}`} variant="body2" fontWeight={500}>
                {startup.email}
              </Link>
            ) : (
              <Typography variant="body2" color="text.disabled">
                —
              </Typography>
            )}
          </Dado>
        </Grid>
      </Secao>

      <Divider sx={{ mb: 3 }} />

      <Secao icone={<Phone fontSize="small" color="primary" />} titulo="Contatos">
        {contatos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum contato cadastrado.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {contatos.map((c) => (
              <Grid item xs={12} sm={6} key={c.id_contato}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: c.principal ? "primary.main" : "divider",
                    p: 2,
                    height: "100%",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {c.nome}
                    </Typography>
                    {c.principal && <Chip size="small" label="Principal" color="primary" />}
                  </Box>
                  {c.cargo && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {c.cargo}
                    </Typography>
                  )}
                  {c.email && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
                      <Email sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Link href={`mailto:${c.email}`} variant="caption" noWrap>
                        {c.email}
                      </Link>
                    </Box>
                  )}
                  {c.telefone && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                      <Phone sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="caption">{formatarCelular(c.telefone)}</Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Secao>

      <Divider sx={{ mb: 3 }} />

      <Secao icone={<LocationOn fontSize="small" color="primary" />} titulo="Endereço">
        {!temEndereco ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum endereço cadastrado.
          </Typography>
        ) : (
          <Grid container spacing={2.5}>
            <Dado rotulo="CEP" valor={formatarCep(startup.cep)} sm={3} />
            <Dado rotulo="Logradouro" valor={enderecoLinha1} sm={9} />
            <Dado rotulo="Bairro / Cidade" valor={enderecoLinha2} sm={9} />
            <Dado rotulo="Complemento" valor={startup.complemento} sm={3} />
          </Grid>
        )}
      </Secao>

      {extrasPreenchidos.length > 0 && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Secao icone={<Notes fontSize="small" color="primary" />} titulo="Informações complementares">
            <Grid container spacing={2.5}>
              {extrasPreenchidos.map(({ campo, texto }) => (
                <Dado key={campo.chave} rotulo={campo.rotulo} valor={texto} sm={4} />
              ))}
            </Grid>
          </Secao>
        </>
      )}

      {startup.observacoes && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Secao icone={<Notes fontSize="small" color="primary" />} titulo="Observações">
            {/* pre-line preserva as quebras de linha que quem escreveu usou
                para separar assuntos. */}
            <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
              {startup.observacoes}
            </Typography>
          </Secao>
        </>
      )}
    </Box>
  )
}
