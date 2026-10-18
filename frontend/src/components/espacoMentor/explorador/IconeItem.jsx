/**
 * O icone de um item do explorador: a pasta amarela, o formato do material
 * (IconeFormato) ou, na grade, a MINIATURA da imagem — como o Windows faz com
 * fotos.
 *
 * A miniatura e o proprio arquivo (privado: vem com o token, como blob). Fica
 * guardada por arquivo enquanto a pagina viver: voltar a uma pasta nao baixa
 * as imagens de novo, e uma versao nova (outro id_arquivo) baixa a nova.
 */
import { useEffect, useState } from "react"
import { Box } from "@mui/material"
import { Folder, FolderOpen } from "@mui/icons-material"
import IconeFormato from "../IconeFormato"
import { buscarArquivo } from "../../../services/arquivos"
import { urlArquivoDoMaterial } from "../../../hooks/useEspacoMentor"
import { ehPasta, tipoDePrevia } from "../../../data/exploradorMeta"
import { MARCA } from "../../../theme"

// Acima disso a miniatura custaria mais do que ajuda: fica o icone.
const MAX_MINIATURA = 4 * 1024 * 1024
const miniaturas = new Map() // id_arquivo -> Promise<string objectURL>

function miniaturaDe(material) {
  if (!miniaturas.has(material.id_arquivo)) {
    miniaturas.set(
      material.id_arquivo,
      buscarArquivo(urlArquivoDoMaterial(material))
        .then((b) => URL.createObjectURL(b))
        .catch((err) => {
          miniaturas.delete(material.id_arquivo)
          throw err
        })
    )
  }
  return miniaturas.get(material.id_arquivo)
}

/** O amarelo de pasta: o do logo no escuro; mais fundo no claro, onde ele some. */
export const corDePasta = (theme) => (theme.palette.mode === "dark" ? MARCA.logo.amarelo : "#d99a00")

export default function IconeItem({ item, tamanho = 32, miniatura = false, aberta = false }) {
  const [url, setUrl] = useState(null)
  const usaMiniatura =
    miniatura &&
    !ehPasta(item) &&
    tipoDePrevia(item) === "IMAGEM" &&
    item.id_arquivo &&
    (Number(item.arquivo_tamanho) || 0) <= MAX_MINIATURA

  useEffect(() => {
    setUrl(null)
    if (!usaMiniatura) return undefined
    let cancelado = false
    miniaturaDe(item)
      .then((u) => !cancelado && setUrl(u))
      .catch(() => {})
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usaMiniatura, item.id_arquivo])

  if (ehPasta(item)) {
    const Icone = aberta ? FolderOpen : Folder
    return <Icone aria-hidden sx={{ fontSize: tamanho, color: corDePasta, flexShrink: 0 }} />
  }

  if (url) {
    return (
      <Box
        component="img"
        src={url}
        alt=""
        aria-hidden
        sx={{
          width: tamanho,
          height: tamanho,
          objectFit: "cover",
          borderRadius: "4px",
          border: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      />
    )
  }
  return <IconeFormato item={item} tamanho={tamanho} />
}
