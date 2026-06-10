<!--Registra Utilidad-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:utilityExtension="Satcom:Util:ClsPdfExtension" version="1.0" exclude-result-prefixes="msxsl utilityExtension">
	<xsl:output method="xml" indent="yes" omit-xml-declaration="yes" encoding="utf-8"/>
	<xsl:template match="/">
		<!--VARIABLES-->
		<xsl:variable name="logo1" select="DatosPDF/DtoEmisor/PathLogo1"/>
		<xsl:variable name="logo2" select="DatosPDF/DtoEmisor/PathLogo2"/>
		<xsl:variable name="logo3" select="DatosPDF/DtoEmisor/PathLogo3"/>
		<xsl:variable name="barras" select="utilityExtension:GetCodigoBarras(DatosPDF/Requerimiento/ClaveAcceso)"/>
		<fo:root xmlns:fo="http://www.w3.org/1999/XSL/Format">
			<fo:layout-master-set>
				<!-- Definición de la pagina-->
				<fo:simple-page-master master-name="simple" page-height="29.7cm" page-width="21cm" margin-top="0.5cm" margin-bottom="0.5cm" margin-left="2cm" margin-right="2cm">
					<fo:region-body margin-top="1cm" margin-bottom="4cm"/>
					<fo:region-before extent="1cm"/>
					<!-- Cabecera de pagina-->
					<fo:region-after extent="3cm"/>
					<!-- Pie de pagina-->
				</fo:simple-page-master>
			</fo:layout-master-set>
			<fo:page-sequence master-reference="simple">
				<!--INICIO  PIE DE PAGINA region-after-->
				<fo:static-content flow-name="xsl-region-after">
					<fo:block text-align="center" border-bottom-color="rgb(0, 0, 0)">mySatcom</fo:block>
					<!--Numeración de página-->
					<fo:block text-align="right" font-size="8pt" padding-top="0.3cm">Pag.<fo:page-number/>/<fo:page-number-citation ref-id="last-page"/>
					</fo:block>
				</fo:static-content>
				<!--FIN     PIE DE PAGINA region-after-->
				<fo:flow flow-name="xsl-region-body" font-family="Helvetica" font-size="8pt">
					<!--CABECERA-->
					<fo:block text-align="center" padding-top="1cm">
						<fo:table table-layout="fixed">
							<fo:table-column column-width="8.5cm" column-number="1"/>
							<fo:table-column column-width="8.5cm" column-number="2"/>
							<fo:table-body font-size="7pt">
								<!--Contenedor info CONTRIBUYENTE-->
								<fo:table-row>
									<!--Columna 1 - LOGO -->
									<fo:table-cell border-width="0.5pt" text-align="left" padding="0pt">
										<fo:table table-layout="fixed" padding="0pt">
											<fo:table-column column-width="8cm" column-number="1"/>
											<fo:table-body>
												<!--LOGO-->
												<fo:table-row>
													<fo:table-cell text-align="center" padding-top="0pt">
														<fo:block>
															<fo:external-graphic src="url('{$logo1}')" width="206pt" height="140pt"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--DatosPDF/Requerimiento SRI-->
												<fo:table-row>
													<fo:table-cell text-align="left" padding-top="0pt">
														<fo:table border-style="solid" border-width="0.1pt" table-layout="fixed" padding="3pt">
															<fo:table-column column-width="2.5cm" column-number="1"/>
															<fo:table-column column-width="3.5cm" column-number="2"/>
															<fo:table-column column-width="2cm" column-number="3"/>
															<fo:table-body>
																<fo:table-row>
																	<fo:table-cell text-align="left" number-columns-spanned="3" font-size="8pt" font-weight="bold">
																		<fo:block>
																			<xsl:value-of select="DatosPDF/DtoEmisor/RazonSocial"/>
																		</fo:block>
																	</fo:table-cell>
																</fo:table-row>
																<!-- <fo:table-row>																	<fo:table-cell text-align="left" number-columns-spanned="3">																		<fo:block>																			<xsl:value-of select="DatosPDF/DtoEmisor/Nombre" />																		</fo:block>																	</fo:table-cell>																</fo:table-row> -->
																<fo:table-row>
																	<fo:table-cell text-align="left">
																		<fo:block>Dirección Matríz</fo:block>
																	</fo:table-cell>
																	<fo:table-cell text-align="left" number-columns-spanned="2">
																		<fo:block>
																			<xsl:value-of select="DatosPDF/DtoEmisor/DireccionMatriz"/>
																		</fo:block>
																	</fo:table-cell>
																</fo:table-row>
																<!-- <fo:table-row> -->
																<!-- <fo:table-cell text-align="left"> -->
																<!-- <fo:block>Email:</fo:block> -->
																<!-- </fo:table-cell> -->
																<!-- <fo:table-cell text-align="left" number-columns-spanned="2"> -->
																<!-- <fo:block>atapia.huertagrill@gmail.com</fo:block> -->
																<!-- </fo:table-cell> -->
																<!-- </fo:table-row> -->
																<fo:table-row>
																	<fo:table-cell text-align="left">
																		<fo:block>Dirección Sucursal</fo:block>
																	</fo:table-cell>
																	<fo:table-cell text-align="left" number-columns-spanned="2">
																		<fo:block>
																			<xsl:value-of select="DatosPDF/DtoEstablecimiento/Direccion"/>
																		</fo:block>
																	</fo:table-cell>
																</fo:table-row>
																<!-- <fo:table-row>																	<fo:table-cell text-align="left">																		<fo:block>Teléfono:</fo:block>																	</fo:table-cell>																	<fo:table-cell text-align="left">																		<fo:block> (02) 2 226-767 /(02) 2 227-630</fo:block>																	</fo:table-cell>																</fo:table-row> -->
																<fo:table-row>
																	<fo:table-cell text-align="left" number-columns-spanned="2">
																		<fo:block>Contribuyente especial No:</fo:block>
																	</fo:table-cell>
																	<fo:table-cell text-align="left">
																		<fo:block>
																			<xsl:value-of select="DatosPDF/DtoEmisor/AutorizacionTributaria"/>
																		</fo:block>
																	</fo:table-cell>
																</fo:table-row>
																<fo:table-row>
																	<fo:table-cell text-align="left" number-columns-spanned="2">
																		<fo:block>Obligado a llevar contabilidad:</fo:block>
																	</fo:table-cell>
																	<fo:table-cell text-align="left">
																		<fo:block>
																			<xsl:value-of select="utilityExtension:GetSINO(DatosPDF/DtoEmisor/ObligadoContabilidad)"/>
																		</fo:block>
																	</fo:table-cell>
																</fo:table-row>
															</fo:table-body>
														</fo:table>
													</fo:table-cell>
												</fo:table-row>
											</fo:table-body>
										</fo:table>
									</fo:table-cell>
									<!--Columna 2 - INFO-->
									<fo:table-cell text-align="left" padding="0pt">
										<fo:table border-style="solid" border-width="0.1pt" table-layout="fixed" padding="6pt">
											<fo:table-column column-width="3cm" column-number="1"/>
											<fo:table-column column-width="5.5cm" column-number="2"/>
											<fo:table-body font-size="8pt">
												<!--RUC-->
												<fo:table-row>
													<!--Descripcion-->
													<fo:table-cell text-align="left" padding="2pt" font-weight="bold" padding-top="10pt">
														<fo:block>R.U.C.:</fo:block>
													</fo:table-cell>
													<!--Valor-->
													<fo:table-cell text-align="left" padding="2pt">
														<fo:block>
															<xsl:value-of select="DatosPDF/DtoEmisor/IdentificacionPrincipal"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Comprobante-->
												<fo:table-row>
													<fo:table-cell text-align="left" number-columns-spanned="2" padding="2pt" font-size="12pt" font-weight="bold">
														<fo:block>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '01'">									FACTURA								</xsl:if>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '04'">									NOTA DE CREDITO								</xsl:if>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '05'">									NOTA DE DEBITO								</xsl:if>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '06'">									GUIA DE REMISION								</xsl:if>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '07'">									COMPROBANTE DE RETENCION								</xsl:if>
															<xsl:if test="DatosPDF/Requerimiento/Codigo = '03'">									LIQUIDACION DE COMPRA DE BIENES Y PRESTACIÓN DE SERVICIOS								</xsl:if>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--N°-->
												<fo:table-row>
													<!--Descripcion-->
													<fo:table-cell column-width="1cm" text-align="left" padding="2pt" font-size="12pt" font-weight="bold">
														<fo:block>No.</fo:block>
													</fo:table-cell>
													<!--Valor-->
													<fo:table-cell text-align="left" padding="2pt" font-size="12pt">
														<fo:block>
															<xsl:value-of select="DatosPDF/Requerimiento/Establecimiento"/>-<xsl:value-of select="DatosPDF/Requerimiento/Punto"/>-<xsl:value-of select="DatosPDF/Requerimiento/NumeroDocumento"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Número de autorización-->
												<fo:table-row>
													<fo:table-cell text-align="left" number-columns-spanned="2" padding="2pt" font-weight="bold">
														<fo:block>NÚMERO DE AUTORIZACIÓN</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Autorización-->
												<xsl:choose>
													<xsl:when test="DatosPDF/Requerimiento/NumeroAutorizacion!=''">
														<fo:table-row>
															<fo:table-cell text-align="left" padding="2pt" number-columns-spanned="2">
																<fo:block>
																	<xsl:value-of select="DatosPDF/Requerimiento/NumeroAutorizacion"/>
																</fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:when>
													<xsl:otherwise>
														<fo:table-row>
															<fo:table-cell text-align="left" padding="2pt" number-columns-spanned="2">
																<fo:block>                                  **                                </fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:otherwise>
												</xsl:choose>
												<!--Fecha y hora de autorizacion-->
												<fo:table-row>
													<!--Descripcion-->
													<fo:table-cell text-align="left" number-columns-spanned="2" padding="2pt" font-weight="bold">
														<fo:block>FECHA Y HORA DE AUTORIZACIÓN</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<xsl:choose>
													<xsl:when test="DatosPDF/Requerimiento/NumeroAutorizacion!=''">
														<fo:table-row>
															<!--Valor-->
															<fo:table-cell text-align="left" padding="2pt" number-columns-spanned="2">
																<fo:block>
																	<xsl:value-of select="utilityExtension:AjustarPalabras(DatosPDF/Requerimiento/FechaAutorizacion,10)"/>
																</fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:when>
													<xsl:otherwise>
														<fo:table-row>
															<fo:table-cell text-align="left" padding="2pt" number-columns-spanned="2">
																<fo:block>                                  **                                </fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:otherwise>
												</xsl:choose>
												<!--Ambiente-->
												<fo:table-row>
													<!--Descripcion-->
													<fo:table-cell text-align="left" padding-top="2pt" font-weight="bold">
														<fo:block> AMBIENTE</fo:block>
													</fo:table-cell>
													<!--Valor-->
													<fo:table-cell text-align="left" padding-top="2pt">
														<fo:block>
															<xsl:value-of select="utilityExtension:GetStringAmbiente(DatosPDF/Requerimiento/Ambiente)"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Tipo de Emision-->
												<fo:table-row>
													<!--Descripcion-->
													<fo:table-cell text-align="left" padding-top="5pt" font-weight="bold">
														<fo:block> EMISION</fo:block>
													</fo:table-cell>
													<!--Valor-->
													<xsl:choose>
														<xsl:when test="DatosPDF/Requerimiento/NumeroAutorizacion!=''">
															<fo:table-cell text-align="left" padding-top="5pt">
																<fo:block>                                  NORMAL                                </fo:block>
															</fo:table-cell>
														</xsl:when>
														<xsl:otherwise>
															<fo:table-cell text-align="left" padding="2pt" number-columns-spanned="2">
																<fo:block>                                  INDISPONIBILIDAD DEL SISTEMA                                </fo:block>
															</fo:table-cell>
														</xsl:otherwise>
													</xsl:choose>
												</fo:table-row>
												<fo:table-row>
													<fo:table-cell text-align="left" padding-top="8pt" number-columns-spanned="2" font-weight="bold">
														<fo:block>CLAVE DE ACCESO</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Código de barras-->
												<fo:table-row>
													<fo:table-cell text-align="center" number-columns-spanned="2">
														<fo:block>
															<fo:external-graphic src="url('{$barras}')" content-width="240" content-height="115"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Clave de acceso-->
												<fo:table-row>
													<fo:table-cell padding="2pt" number-columns-spanned="2">
														<fo:block text-align="center">
															<xsl:value-of select="DatosPDF/Requerimiento/ClaveAcceso"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
											</fo:table-body>
										</fo:table>
									</fo:table-cell>
								</fo:table-row>
							</fo:table-body>
						</fo:table>
					</fo:block>
					<!--Info Contribuyente-->
					<fo:block padding-top="0.3cm">
						<fo:table border-collapse="collapse" border-style="solid" border-width="0.1pt" padding="5pt">
							<fo:table-column column-width="3.5cm" column-number="1"/>
							<fo:table-column column-width="6.5cm" column-number="2"/>
							<fo:table-column column-width="3cm" column-number="3"/>
							<fo:table-column column-width="4cm" column-number="4"/>
							<fo:table-body font-size="7pt">
								<fo:table-row>
									<fo:table-cell text-align="left" font-weight="bold">
										<fo:block>Razón Social/Nombres y Apellidos:</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="left">
										<fo:block>
											<xsl:value-of select="DatosPDF/Requerimiento/Cliente/RazonSocial"/>
										</fo:block>
									</fo:table-cell>
									<fo:table-cell border-width="0.2pt" text-align="left" font-weight="bold">
										<fo:block>Fecha Emisión:</fo:block>
									</fo:table-cell>
									<fo:table-cell border-width="0.2pt" text-align="left">
										<fo:block>
											<xsl:value-of select="DatosPDF/Requerimiento/FechaEmision"/>
										</fo:block>
									</fo:table-cell>
								</fo:table-row>
								<fo:table-row>
									<fo:table-cell border-width="0.5pt" text-align="left" font-weight="bold">
										<fo:block>Identificación:</fo:block>
									</fo:table-cell>
									<fo:table-cell border-width="0.5pt" text-align="left">
										<fo:block>
											<xsl:value-of select="DatosPDF/Requerimiento/Cliente/NumeroIdentificacion"/>
										</fo:block>
									</fo:table-cell>
									<fo:table-cell border-width="0pt" text-align="left" font-weight="bold" padding-left="3pt" padding-bottom="3pt">
										<fo:block>Email:</fo:block>
									</fo:table-cell>
									<fo:table-cell border-width="0pt" text-align="left" padding-left="3pt" padding-bottom="3pt">
										<fo:block>
											<xsl:value-of select="DatosPDF/Requerimiento/Cliente/email"/>
										</fo:block>
									</fo:table-cell>
									<!--<fo:table-cell border-width="0.5pt"  text-align="left" font-weight="bold">                    <fo:block>Guía Remisión:</fo:block>                  </fo:table-cell>                  <fo:table-cell border-width="0.5pt"  text-align="left" >                    <fo:block>*</fo:block>                  </fo:table-cell>-->
								</fo:table-row>
								<fo:table-row>
									<fo:table-cell border-width="0.5pt" text-align="left" font-weight="bold">
										<fo:block>Dirección:</fo:block>
									</fo:table-cell>
									<xsl:choose>
										<xsl:when test="DatosPDF/Requerimiento/Cliente/Direccion != ''">
											<fo:table-cell border-width="0.5pt" text-align="left">
												<fo:block>
													<xsl:value-of select="DatosPDF/Requerimiento/Cliente/Direccion"/>
												</fo:block>
											</fo:table-cell>
										</xsl:when>
										<xsl:otherwise>
											<xsl:for-each select="DatosPDF/Requerimiento/InformacionAdicional/Campo">
												<xsl:if test="translate(Descripcion, 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')='DIRECCION'">
													<fo:table-cell border-width="0.5pt" text-align="left">
														<fo:block>
															<xsl:value-of select="Valor"/>
														</fo:block>
													</fo:table-cell>
												</xsl:if>
											</xsl:for-each>
										</xsl:otherwise>
									</xsl:choose>
								</fo:table-row>
								<fo:table-row>
									<fo:table-cell border-width="0.5pt" text-align="left" font-weight="bold">
										<fo:block>Teléfonos:</fo:block>
									</fo:table-cell>
									<xsl:choose>
										<xsl:when test="DatosPDF/Requerimiento/Cliente/Telefono != ''">
											<fo:table-cell border-width="0.5pt" text-align="left">
												<fo:block>
													<xsl:value-of select="DatosPDF/Requerimiento/Cliente/Telefono"/>
												</fo:block>
											</fo:table-cell>
										</xsl:when>
										<xsl:otherwise>
											<xsl:for-each select="DatosPDF/Requerimiento/InformacionAdicional/Campo">
												<xsl:if test="translate(Descripcion, 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')='TELEFONO'">
													<fo:table-cell border-width="0.5pt" text-align="left">
														<fo:block>
															<xsl:value-of select="Valor"/>
														</fo:block>
													</fo:table-cell>
												</xsl:if>
											</xsl:for-each>
										</xsl:otherwise>
									</xsl:choose>
								</fo:table-row>
							</fo:table-body>
						</fo:table>
					</fo:block>
					<!--Info Nota de Credito-->
					<xsl:if test="DatosPDF/Requerimiento/Codigo='04'">
						<fo:block padding-top="0.3cm" border-collapse="collapse">
							<fo:table border-collapse="collapse" border-style="solid" border-width="0.1pt" padding="5pt">
								<fo:table-column column-width="3.5cm" column-number="1"/>
								<fo:table-column column-width="13.5cm" column-number="2"/>
								<fo:table-body font-size="7pt">
									<fo:table-row>
										<fo:table-cell text-align="left" font-weight="bold">
											<fo:block>Comprobante modificado:</fo:block>
										</fo:table-cell>
										<fo:table-cell text-align="left">
											<fo:block>
												<xsl:value-of select="DatosPDF/Requerimiento/DocumentosAsociados/Documento/Descripcion"/>
												<xsl:value-of select="DatosPDF/Requerimiento/DocumentosAsociados/Documento/NumeroDocumento"/>
											</fo:block>
										</fo:table-cell>
									</fo:table-row>
									<fo:table-row>
										<fo:table-cell border-width="0.5pt" text-align="left" font-weight="bold">
											<fo:block>Fecha Emision:</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" text-align="left">
											<fo:block>
												<xsl:value-of select="DatosPDF/Requerimiento/DocumentosAsociados/Documento/FechaEmision"/>
											</fo:block>
										</fo:table-cell>
									</fo:table-row>
									<fo:table-row>
										<fo:table-cell border-width="0.5pt" text-align="left" font-weight="bold">
											<fo:block>Motivo:</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" text-align="left">
											<fo:block>
												<xsl:value-of select="DatosPDF/Requerimiento/DocumentosAsociados/Documento/Motivos/Motivo/Descripcion"/>
											</fo:block>
										</fo:table-cell>
									</fo:table-row>
								</fo:table-body>
							</fo:table>
						</fo:block>
					</xsl:if>
					<!--Info detalles-->
					<fo:block text-align="center" padding-top="0.3cm">
						<fo:table border-collapse="collapse" table-layout="fixed">
							<fo:table-column column-width="1.5cm" column-number="1"/>
							<fo:table-column column-width="1cm" column-number="2"/>
							<fo:table-column column-width="1.5cm" column-number="3"/>
							<fo:table-column column-width="4cm" column-number="4"/>
							<fo:table-column column-width="3cm" column-number="5"/>
							<fo:table-column column-width="2cm" column-number="6"/>
							<fo:table-column column-width="2cm" column-number="7"/>
							<fo:table-column column-width="2cm" column-number="8"/>
							<fo:table-header font-size="6pt">
								<fo:table-row height="1cm" display-align="center">
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Cod. Principal</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Cod. Auxiliar</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Cant</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Descripción</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Detalle Adicional</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Precio Unitario</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Descuento</fo:block>
									</fo:table-cell>
									<fo:table-cell text-align="center" border-width="0.5pt" border-style="solid" padding="0.5pt">
										<fo:block text-align="center" font-weight="bold">Precio Total</fo:block>
									</fo:table-cell>
								</fo:table-row>
							</fo:table-header>
							<fo:table-body font-size="6pt">
								<xsl:for-each select="/DatosPDF/Requerimiento/Detalles/Detalle">
									<fo:table-row>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="left" padding="2pt">
											<fo:block>
												<xsl:value-of select="Producto/Codigo"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="left" padding="2pt">
											<fo:block>
												<xsl:value-of select="Producto/CodigoAuxiliar"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="right" padding="2pt">
											<fo:block>
												<xsl:value-of select="Cantidad"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="left" padding="2pt">
											<fo:block>
												<xsl:value-of select="Producto/Descripcion"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="left" padding="2pt">
											<fo:block>
												<xsl:value-of select="InformacionAdicional/Campo/Valor"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="right" padding="2pt">
											<fo:block>
												<xsl:value-of select="Producto/ValorUnitario"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="right" padding="2pt">
											<fo:block>
												<xsl:value-of select="Descuento"/>
											</fo:block>
										</fo:table-cell>
										<fo:table-cell border-width="0.5pt" border-style="solid" text-align="right" padding="2pt">
											<fo:block>
												<xsl:value-of select="format-number(SubTotal,'###,##0.00')"/>
											</fo:block>
										</fo:table-cell>
									</fo:table-row>
								</xsl:for-each>
							</fo:table-body>
						</fo:table>
					</fo:block>
					<!--Seccion SUBTOTALES-->
					<fo:block text-align="center">
						<fo:table border-collapse="collapse" table-layout="fixed">
							<fo:table-column column-width="12cm" column-number="1"/>
							<fo:table-column column-width="5cm" column-number="2"/>
							<fo:table-body font-size="6pt">
								<fo:table-row>
									<!--Info adicional-->
									<fo:table-cell border-width="0.5pt" padding="0.5pt" padding-top="0.5cm">
										<fo:table border-collapse="collapse" table-layout="fixed">
											<fo:table-column column-width="2cm" column-number="1"/>
											<fo:table-column column-width="3cm" column-number="2"/>
											<fo:table-body font-size="6pt">
												<!--Cabecera-->
												<fo:table-row>
													<fo:table-cell padding="0.5pt" number-columns-spanned="2" font-weight="bold" font-size="7pt">
														<fo:block text-align="left">Informacion Adicional</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--Moneda-->
												<fo:table-row>
													<fo:table-cell padding="0.5pt">
														<fo:block text-align="left">MONEDA</fo:block>
													</fo:table-cell>
													<fo:table-cell padding="0.5pt">
														<fo:block text-align="left">
															<xsl:value-of select="DatosPDF/Requerimiento/Moneda"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<xsl:for-each select="DatosPDF/Requerimiento/InformacionAdicional/Campo">
													<fo:table-row>
														<!--Campo-->
														<fo:table-cell padding="0.5pt">
															<fo:block text-align="left">
																<fo:block>
																	<xsl:value-of select="Descripcion"/>
																</fo:block>
															</fo:block>
														</fo:table-cell>
														<!--Valor-->
														<fo:table-cell padding="0.5pt">
															<fo:block text-align="left">
																<fo:block>
																	<xsl:value-of select="Valor"/>
																</fo:block>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
												</xsl:for-each>
											</fo:table-body>
										</fo:table>
									</fo:table-cell>
									<!--Info Subtotales-->
									<fo:table-cell>
										<fo:table table-layout="fixed">
											<fo:table-column column-width="3cm" column-number="1" border-end-style="solid" border-end-width="0.1pt"/>
											<fo:table-column column-width="2cm" column-number="2"/>
											<fo:table-body font-size="6pt">
												<!--POR CADA IMPUESTO SE MUESTRA EL SUBTOTAL-->
												<xsl:for-each select="DatosPDF/Requerimiento/Impuestos/Impuesto">
													<fo:table-row text-align="left">
														<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="left" padding-top="0.1cm">
															<fo:block>
																<xsl:if test="CodigoImpuesto='2' and CodigoPorcentaje='0'">									SUBTOTAL 0%								</xsl:if>
																<xsl:if test="CodigoImpuesto='2' and CodigoPorcentaje='2'">									SUBTOTAL 12%								</xsl:if>
																<xsl:if test="CodigoImpuesto='2' and CodigoPorcentaje='3'">									SUBTOTAL 14%								</xsl:if>
																<xsl:if test="CodigoImpuesto='2' and CodigoPorcentaje='6'">									SUBTOTAL NO SUJETO IMPUESTO								</xsl:if>
																<xsl:if test="CodigoImpuesto='2' and CodigoPorcentaje='7'">									SUBTOTAL EXENTO DE IVA								</xsl:if>
															</fo:block>
														</fo:table-cell>
														<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
															<fo:block>
																<xsl:value-of select="format-number(BaseImponible,'###,##0.00')"/>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
												</xsl:for-each>
												<!--SUBTOTAL SIN IMPUESTOS-->
												<fo:table-row text-align="left">
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
														<fo:block>SUBTOTAL SIN IMPUESTOS</fo:block>
													</fo:table-cell>
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
														<fo:block>
															<xsl:value-of select="format-number(DatosPDF/Requerimiento/TotalSinImpuestos,'###,##0.00')"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--DESCUENTO-->
												<fo:table-row text-align="left">
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
														<fo:block>DESCUENTO</fo:block>
													</fo:table-cell>
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
														<fo:block>
															<xsl:value-of select="format-number(sum(DatosPDF/Requerimiento/Detalles/Detalle/Descuento),'###,##0.00')"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--VALOR ICE-->
												<fo:table-row text-align="left">
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
														<fo:block>ICE</fo:block>
													</fo:table-cell>
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
														<fo:block>0.00</fo:block>
													</fo:table-cell>
												</fo:table-row>
												<!--VALOR IVA-->
												<xsl:for-each select="DatosPDF/Requerimiento/Impuestos/Impuesto">
													<fo:table-row text-align="left">
														<xsl:choose>
															<xsl:when test="CodigoImpuesto='2' and CodigoPorcentaje='2'">
																<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
																	<fo:block>IVA 12%</fo:block>
																</fo:table-cell>
																<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
																	<fo:block>
																		<xsl:value-of select="format-number(Valor,'###,##0.00')"/>
																	</fo:block>
																</fo:table-cell>
															</xsl:when>
															<xsl:when test="CodigoImpuesto='2' and CodigoPorcentaje='3'">
																<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
																	<fo:block>IVA 14%</fo:block>
																</fo:table-cell>
																<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
																	<fo:block>
																		<xsl:value-of select="format-number(Valor,'###,##0.00')"/>
																	</fo:block>
																</fo:table-cell>
															</xsl:when>
														</xsl:choose>
													</fo:table-row>
												</xsl:for-each>
												<!--10% SERVICIO-->
												<xsl:if test="DatosPDF/Requerimiento/Propina!=''">
													<fo:table-row text-align="left">
														<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
															<fo:block>10%SERVICIO-PROPINA</fo:block>
														</fo:table-cell>
														<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
															<fo:block>
																<xsl:value-of select="DatosPDF/Requerimiento/Propina"/>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
												</xsl:if>
												<!--TASA MUNICIPAL-->
												<xsl:for-each select="DatosPDF/Requerimiento/InformacionAdicional/Campo">
													<xsl:if test="Descripcion='TASA MUNICIPAL'">
														<fo:table-row text-align="left">
															<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm">
																<fo:block>TASA MUNICIPAL</fo:block>
															</fo:table-cell>
															<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm">
																<fo:block>
																	<xsl:value-of select="format-number(Valor,'###,##0.00')"/>
																</fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:if>
												</xsl:for-each>
												<!--VALOR TOTAL-->
												<fo:table-row text-align="left">
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" padding-top="0.1cm" font-weight="bold">
														<fo:block>VALOR TOTAL</fo:block>
													</fo:table-cell>
													<fo:table-cell border-style="solid" border-width="0.1pt" padding="0.5pt" text-align="right" padding-top="0.1cm" font-weight="bold">
														<fo:block>
															<xsl:value-of select="format-number(DatosPDF/Requerimiento/TotalConImpuestos,'###,##0.00')"/>
														</fo:block>
													</fo:table-cell>
												</fo:table-row>
											</fo:table-body>
										</fo:table>
									</fo:table-cell>
								</fo:table-row>
								<!--Informacion de Reembolso-->
								<xsl:if test="DatosPDF/Requerimiento/TotalComprobantesReembolso !=''">
									<fo:table-row padding="2pt">
										<fo:table-cell padding-top="0.5cm">
											<fo:table border-collapse="collapse" table-layout="fixed">
												<fo:table-column column-width="3cm" column-number="1"/>
												<fo:table-column column-width="5cm" column-number="2"/>
												<fo:table-column column-width="2cm" column-number="3"/>
												<fo:table-column column-width="3cm" column-number="4"/>
												<fo:table-column column-width="1cm" column-number="5"/>
												<fo:table-column column-width="1cm" column-number="6"/>
												<fo:table-column column-width="1cm" column-number="7"/>
												<fo:table-column column-width="1cm" column-number="8"/>
												<fo:table-body font-size="6pt" border-style="solid" border-width="0.1pt">
													<!--Cabecera-->
													<fo:table-row>
														<fo:table-cell padding="2pt" number-columns-spanned="8" font-weight="bold" font-size="7pt">
															<fo:block text-align="center">DATOS DE REEMBOLSO</fo:block>
														</fo:table-cell>
													</fo:table-row>
													<fo:table-row>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="1">
															<fo:block padding="2pt">Identificacion Proveedor</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="2">
															<fo:block padding="2pt">Documento</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="3">
															<fo:block padding="2pt">Numero Documento</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="4">
															<fo:block padding="2pt">Fecha Emisión</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="5">
															<fo:block padding="2pt">Tarifa</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="6">
															<fo:block padding="2pt">Base</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="7">
															<fo:block padding="2pt">Impuesto</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" font-weight="bold" padding-top="0.5pt" border-width="0.1pt" column-number="8">
															<fo:block padding="2pt">Total</fo:block>
														</fo:table-cell>
													</fo:table-row>
													<xsl:for-each select="DatosPDF/Requerimiento/DetallesReembolso/DetalleReembolso ">
														<fo:table-row>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="1">
																<fo:block padding="1pt">
																	<xsl:value-of select="IdentificacionProveedorReembolso"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="2">
																<fo:block padding="1pt">
																	<xsl:if test="codDocReembolso = '01'">FACTURA</xsl:if>
																	<xsl:if test="codDocReembolso = '02'">NOTA/BOLETA DE VENTA</xsl:if>
																	<xsl:if test="codDocReembolso = '03'">LIQUIDACION DE COMPRA</xsl:if>
																	<xsl:if test="codDocReembolso = '04'">NOTA DE CRÉDITO</xsl:if>
																	<xsl:if test="codDocReembolso = '05'">NOTA DE DÉBITO</xsl:if>
																	<xsl:if test="codDocReembolso = '06'">GUÍA DE REMISIÓN</xsl:if>
																	<xsl:if test="codDocReembolso = '07'">RETENCIÓN</xsl:if>
																	<xsl:if test="codDocReembolso = '08'">ENTRADAS A ESPECTÁCULOS PÚBLICOS</xsl:if>
																	<xsl:if test="codDocReembolso = '09'">TIQUETE EMITIDO POR MÁQUINA REGISTRADORA</xsl:if>
																	<xsl:if test="codDocReembolso = '11'">PASAJES EXP. POR EMPRESAS DE AVIACIÓN</xsl:if>
																	<xsl:if test="codDocReembolso = '12'">DOC. EMITIDO POR ENTIDAD FINANCIERA</xsl:if>
																	<xsl:if test="codDocReembolso = '15'">COMP. DE VENTA EMITIDO EN EL EXTERIOR</xsl:if>
																	<xsl:if test="codDocReembolso = '16'">FUE/DAU/DAV</xsl:if>
																	<xsl:if test="codDocReembolso = '18'">DOC. AUTORIZADOS UTILIZADOS EN VENTAS EXCEPTO N/C N/D</xsl:if>
																	<xsl:if test="codDocReembolso = '19'">COMPROBANTES DE PAGO DE CUOTAS O APORTES</xsl:if>
																	<xsl:if test="codDocReembolso = '20'">DOC. POR SERVICIOS ADMINISTRATIVOS EMITIDOS POR INST. DEL ESTADO</xsl:if>
																	<xsl:if test="codDocReembolso = '21'">CARTA DE PORTE AÉREO</xsl:if>
																	<xsl:if test="codDocReembolso = '22'">RECAP</xsl:if>
																	<xsl:if test="codDocReembolso = '23'">NOTA DE CRÉDITO TC</xsl:if>
																	<xsl:if test="codDocReembolso = '24'">NOTA DE DÉBITO TC</xsl:if>
																	<xsl:if test="codDocReembolso = '41'">COMPROBANTE DE VENTA EMITIDO POR REEMBOLSO</xsl:if>
																	<xsl:if test="codDocReembolso = '42'">DOC. AGENTE DE RETENCIÓN PRESUNTIVA</xsl:if>
																	<xsl:if test="codDocReembolso = '43'">LIQ. PARA EXPLOTACIÓN Y EXPLORACIÓN DE HIDROCARBUROS</xsl:if>
																	<xsl:if test="codDocReembolso = '44'">COMPROBANTE DE CONTRIBUCIONES Y APORTES</xsl:if>
																	<xsl:if test="codDocReembolso = '45'">LIQUIDACION POR RECLAMOS DE ASEGURADORAS</xsl:if>
																	<xsl:if test="codDocReembolso = '47'">N/C POR REEMBOLSO EMITIDA POR INTERMEDIARIO</xsl:if>
																	<xsl:if test="codDocReembolso = '48'">N/D POR REEMBOLSO EMITIDA POR INTERMEDIARIO</xsl:if>
																	<xsl:if test="codDocReembolso = '49'">PROVEEDOR DIRECTO DE EXPORTADOR BAJO RÉGIMEN ESPECIAL</xsl:if>
																	<xsl:if test="codDocReembolso = '50'">A INST. ESTADO Y EMPR. PÚBLICAS QUE PERCIBE INGRESO EXENTO DE IMP. RENTA</xsl:if>
																	<xsl:if test="codDocReembolso = '51'">N/C A INST. ESTADO Y EMPR. PÚBLICAS QUE PERCIBE INGRESO EXENTO DE IMP. RENTA</xsl:if>
																	<xsl:if test="codDocReembolso = '52'">N/D A INST. ESTADO Y EMPR. PÚBLICAS QUE PERCIBE INGRESO EXENTO DE IMP. RENTA</xsl:if>
																	<xsl:if test="codDocReembolso = '294'">LIQUIDACION DE COMPRA DE BIENES MUEBLES USADOS</xsl:if>
																	<xsl:if test="codDocReembolso = '344'">LIQUIDACION DE COMPRA DE VEHÍCULOS USADOS</xsl:if>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" column-number="3">
																<fo:block padding="1pt">
																	<xsl:value-of select="EstabDocReembolso"/>-<xsl:value-of select="PtoEmiDocReembolso"/>-<xsl:value-of select="SecuencialDocReembolso"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="4">
																<fo:block padding="1pt">
																	<xsl:value-of select="FechaEmisionDocReembolso"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="5">
																<fo:block padding="1pt">
																	<xsl:value-of select="Impuestos/Impuesto/Porcentaje"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="6">
																<fo:block padding="1pt">
																	<xsl:value-of select="Impuestos/Impuesto/BaseImponible"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="7">
																<fo:block padding="1pt">
																	<xsl:value-of select="Impuestos/Impuesto/Valor"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="8">
																<fo:block padding="1pt">
																	<xsl:value-of select="format-number(Impuestos/Impuesto/BaseImponible + Impuestos/Impuesto/Valor,'0.00') "/>
																</fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:for-each>
													<!--Impuestos aplicados-->
													<fo:table-row>
														<fo:table-cell text-align="left" padding-top="2pt" border-width="0.5pt" column-number="1">
															<fo:block padding="1pt">Total Base Reembolso:</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="2">
															<fo:block>
																<xsl:value-of select="DatosPDF/Requerimiento/TotalBaseImponibleReembolso"/>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
													<fo:table-row>
														<fo:table-cell text-align="left" padding-top="2pt" border-width="0.5pt" column-number="1">
															<fo:block padding="1pt">Total Impuesto Reembolso:</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="2">
															<fo:block>
																<xsl:value-of select="DatosPDF/Requerimiento/TotalImpuestoReembolso"/>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
													<fo:table-row>
														<fo:table-cell text-align="left" padding-top="2pt" border-width="0.5pt" column-number="1">
															<fo:block padding="1pt">Total Comprobante Reembolso:</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="2pt" border-width="0.1pt" column-number="2">
															<fo:block>
																<xsl:value-of select="DatosPDF/Requerimiento/TotalComprobantesReembolso"/>
															</fo:block>
														</fo:table-cell>
													</fo:table-row>
												</fo:table-body>
											</fo:table>
										</fo:table-cell>
									</fo:table-row>
								</xsl:if>
								<!--Fin Reembolso de gastos-->
								<xsl:if test="DatosPDF/Requerimiento/Pagos/Pago !=''">
									<fo:table-row>
										<fo:table-cell padding-top="0.5cm">
											<fo:table border-collapse="collapse" table-layout="fixed">
												<fo:table-column column-width="5cm" column-number="1"/>
												<fo:table-column column-width="2cm" column-number="2"/>
												<fo:table-column column-width="2cm" column-number="3"/>
												<fo:table-column column-width="2cm" column-number="4"/>
												<fo:table-body font-size="6pt" border-style="solid" border-width="0.1pt">
													<fo:table-row>
														<fo:table-cell text-align="center" padding-top="0.5pt" border-style="solid" border-width="0.1pt" column-number="1">
															<fo:block padding="2pt">FORMA DE PAGO</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="0.5pt" border-style="solid" border-width="0.1pt" column-number="2">
															<fo:block padding="2pt">VALOR</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="0.5pt" border-style="solid" border-width="0.1pt" column-number="3">
															<fo:block padding="2pt">PLAZO</fo:block>
														</fo:table-cell>
														<fo:table-cell text-align="center" padding-top="0.5pt" border-style="solid" border-width="0.1pt" column-number="4">
															<fo:block padding="2pt">TIEMPO</fo:block>
														</fo:table-cell>
													</fo:table-row>
													<xsl:for-each select="DatosPDF/Requerimiento/Pagos/Pago">
														<fo:table-row>
															<fo:table-cell text-align="center" padding-top="0.5pt" border-right="solid" border-width="0.1pt" column-number="1">
																<fo:block padding="1pt">
																	<xsl:value-of select="translate(FormaPagoEcuador, '_', ' ')"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="0.5pt" border-right="solid" border-width="0.1pt" column-number="2">
																<fo:block padding="1pt">
																	<xsl:value-of select="format-number(Total,'###,##0.00')"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="0.5pt" border-right="solid" border-width="0.1pt" column-number="3">
																<fo:block padding="1pt">
																	<xsl:value-of select="Plazo"/>
																</fo:block>
															</fo:table-cell>
															<fo:table-cell text-align="center" padding-top="0.5pt" column-number="4">
																<fo:block padding="1pt">
																	<xsl:value-of select="UnidadTiempo"/>
																</fo:block>
															</fo:table-cell>
														</fo:table-row>
													</xsl:for-each>
												</fo:table-body>
											</fo:table>
										</fo:table-cell>
									</fo:table-row>
								</xsl:if>
							</fo:table-body>
						</fo:table>
					</fo:block>
					<fo:block id="last-page"/>
				</fo:flow>
			</fo:page-sequence>
		</fo:root>
	</xsl:template>
</xsl:stylesheet>