USE [sat_logging]
GO

/****** Object:  Table [dbo].[log_control_consultas]    Script Date: 5/5/2026 9:06:47 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[log_control_consultas](
	[cc_id_comprobante] [bigint] NULL,
	[cc_fecha_proceso] [datetime] NULL,
	[cc_consultas] [bigint] NULL,
	[cc_existe_bdd] [int] NULL,
	[cc_origen] [varchar](200) NULL,
	[cc_id_emisor] [int] NULL,
	[cc_procedimiento] [varchar](100) NULL,
	[cc_parametros] [varchar](200) NULL,
	[cc_pais] [int] NULL
) ON [PRIMARY]
GO


