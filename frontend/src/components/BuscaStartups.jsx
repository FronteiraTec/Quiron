/**
 * BuscaStartups - campo de busca de startups da Navbar.
 *
 * Visibilidade por papel (mesma regra aplicada pelo GET /startups):
 *   - admin  -> todas as startups da incubadora;
 *   - mentor -> apenas as que ele acompanha (tabela mentor_startup);
 *   - usuario/root -> o campo nem e exibido (o usuario comum tem a propria
 *     startup em "Minha Startup"; o root nao opera dentro de um tenant).
 *
 * O backend ja devolve a lista restrita; aqui apenas escondemos o campo de
 * quem nao tem o que buscar. Selecionar um item leva a /startups/:uuid.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { styled, alpha } from "@mui/material/styles"
import {
  Autocomplete,
  Avatar,
  Box,
  InputBase,
  CircularProgress,
  Typography,
} from "@mui/material"
import { Search as SearchIcon } from "@mui/icons-material"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { resolverPapel } from "./sidebar/menuConfig"

// Campo de busca estilizado (do exemplo do MUI), sobre a AppBar colorida. O
// veu sai da cor do texto da barra (palette.barra): sobre uma barra clara (o
// lima, com texto preto) um veu branco sumiria.
const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.barra.texto, 0.1),
  "&:hover": { backgroundColor: alpha(theme.palette.barra.texto, 0.16) },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: { marginLeft: theme.spacing(3), width: "auto" },
}))

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}))

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  width: "100%",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: { width: "24ch" },
    "&::placeholder": { color: "inherit", opacity: 0.7 },
  },
}))

function iniciais(nome = "") {
  return nome.trim().slice(0, 1).toUpperCase() || "?"
}

export default function BuscaStartups() {
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()

  const [startups, setStartups] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [texto, setTexto] = useState("")

  const papel = resolverPapel(usuario)
  const idTenant = usuario?.id_tenant ?? null
  // So admin e mentor buscam startups - e sempre dentro de uma incubadora.
  const podeBuscar = (papel === "admin" || papel === "mentor") && !!idTenant

  useEffect(() => {
    if (!podeBuscar) return

    let cancelado = false
    setCarregando(true)
    api
      .get("/startups", { params: { id_tenant: idTenant } })
      .then(({ data }) => {
        if (!cancelado) setStartups(data.startups || [])
      })
      .catch(() => {
        // Falha na busca nao deve quebrar a Navbar: fica sem sugestoes.
        if (!cancelado) setStartups([])
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [podeBuscar, idTenant])

  if (!podeBuscar) return null

  return (
    <Autocomplete
      options={startups}
      loading={carregando}
      value={null}
      inputValue={texto}
      onInputChange={(_, valor) => setTexto(valor)}
      onChange={(_, startup) => {
        if (!startup) return
        setTexto("")
        navigate(`/startups/${startup.uuid}`)
      }}
      getOptionLabel={(s) => s.nome || ""}
      isOptionEqualToValue={(s, v) => s.id_startup === v.id_startup}
      blurOnSelect
      clearOnBlur
      handleHomeEndKeys
      noOptionsText={carregando ? "Carregando…" : "Nenhuma startup encontrada"}
      slotProps={{
        paper: {
          sx: { minWidth: 280, borderRadius: "12px", boxShadow: "0 8px 28px rgba(15,23,42,0.12)" },
        },
      }}
      renderOption={(props, s) => {
        // Descarta o `key` do MUI e usa o id da startup (estavel em qualquer versao).
        const { key, ...rest } = props
        return (
          <Box key={s.id_startup} component="li" {...rest} sx={{ gap: 1.5 }}>
            <Avatar
              variant="rounded"
              sx={{ width: 32, height: 32, borderRadius: "8px", fontSize: 14, bgcolor: "primary.main" }}
            >
              {iniciais(s.nome)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap fontWeight={600}>
                {s.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {s.fase_atual || "Sem fase em andamento"}
              </Typography>
            </Box>
          </Box>
        )
      }}
      renderInput={(params) => (
        <Search data-tour="nav-busca" ref={params.InputProps.ref}>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            inputProps={{ ...params.inputProps, "aria-label": "buscar startup" }}
            placeholder="Buscar startup…"
            endAdornment={
              carregando ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null
            }
          />
        </Search>
      )}
    />
  )
}
