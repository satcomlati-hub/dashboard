USE [sat_catalogo]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[sc_documentos_autorizados_2026](
	[IdComprobante] [decimal](18, 0) NOT NULL,
	[HoraIn] [datetime] NULL,
	[HoraReproceso] [datetime] NULL,
	[Reprocesos] [int] NULL,
	[Estatus] [smallint] NULL,
	[IdEmisor] [int] NULL,
	[NumComprobante] [varchar](50) NULL,
	[TipoComprobante] [smallint] NULL,
	[CodigoTipoComprobante] [varchar](5) NULL,
	[NumComprobanteAsociado] [varchar](50) NULL,
	[TotalComprobante] [decimal](15, 2) NULL,
	[Canal] [smallint] NULL,
	[Pais] [smallint] NULL,
	[ClaveAcceso] [varchar](300) NULL,
	[Anio] [int] NULL,
	[FechaEmision] [date] NULL
) ON [PRIMARY]
GO

CREATE NONCLUSTERED INDEX [IDX_001_Documentos_2026] ON [dbo].[sc_documentos_autorizados_2026]
(
	[IdEmisor] ASC,
	[CodigoTipoComprobante] ASC,
	[NumComprobante] ASC,
	[FechaEmision] ASC,
	[Anio] ASC,
	[ClaveAcceso] ASC,
	[IdComprobante] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 90, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
